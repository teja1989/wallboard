# ---------------------------------------------------------------------------
# The service, its identity, and the narrowest set of roles that identity can
# do its job with.
# ---------------------------------------------------------------------------

resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = "${var.service_name}-run"
  display_name = "Marquee Cloud Run runtime"
  description  = "Identity the app runs as. Not a deploy identity."
}

resource "google_project_iam_member" "run_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.run.email}"
}

/**
 * Session cookies and custom claims.
 *
 * `createSessionCookie`, `verifySessionCookie(checkRevoked)` and the owner-role
 * claim all go through the Identity Toolkit admin API, which is what this role
 * grants. Without it, nobody can sign in at all.
 */
resource "google_project_iam_member" "run_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# Scoped to the one bucket rather than granted project-wide.
resource "google_storage_bucket_iam_member" "run_media" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.run.email}"
}

/**
 * The permission that makes signed URLs possible.
 *
 * On Cloud Run there is no service-account key file, so the Storage SDK cannot
 * sign a V4 URL locally. It calls IAM's signBlob on its own behalf instead,
 * which requires the account to be a token creator *for itself*. Miss this and
 * every upload and every image on the wall fails with a permission error that
 * names nothing useful.
 */
resource "google_service_account_iam_member" "run_self_sign" {
  service_account_id = google_service_account.run.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_secrets" {
  for_each = google_secret_manager_secret.this

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_cloud_run_v2_service" "app" {
  project  = var.project_id
  name     = var.service_name
  location = var.region

  # Direct traffic only. An internal-only ingress would keep the public off a
  # public website.
  ingress = "INGRESS_TRAFFIC_ALL"

  # `terraform apply` runs before the image is pushed on the second phase of a
  # deploy, so the image is managed but the revision annotations Cloud Run adds
  # on its own are not fought over.
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    scaling {
      # Zero. An idle service costs nothing, which is the whole argument for
      # Cloud Run on traffic shaped like "one party, then nothing for a week".
      min_instance_count = var.min_instances
      # And a ceiling, because the failure mode of autoscaling is a bill.
      max_instance_count = var.max_instances
    }

    # The cleanup sweep declares a 300s budget and the archive download streams
    # a whole event's media, so the request timeout has to clear both.
    timeout = "900s"

    # Next is I/O-bound here — every request is waiting on Firestore or on GCS —
    # so one instance serves many requests at once, and 80 concurrent requests
    # on one instance is far cheaper than 80 instances.
    max_instance_request_concurrency = 80

    containers {
      image = local.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # CPU is billed only while a request is in flight. The in-process
        # signed-URL cache survives between requests either way, because the
        # instance is throttled rather than destroyed.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NEXT_PUBLIC_SITE_URL"
        value = local.site_url
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_API_KEY"
        value = data.google_firebase_web_app_config.this.api_key
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        value = data.google_firebase_web_app_config.this.auth_domain
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        value = google_storage_bucket.media.name
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_APP_ID"
        value = google_firebase_web_app.this.app_id
      }
      env {
        name  = "NEXT_PUBLIC_GOOGLE_SIGN_IN"
        value = tostring(var.google_sign_in)
      }
      env {
        name  = "NEXT_PUBLIC_USE_EMULATORS"
        value = "false"
      }

      env {
        name  = "STORAGE_DRIVER"
        value = "gcs"
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.media.name
      }
      env {
        name  = "OWNER_EMAILS"
        value = var.owner_emails
      }
      env {
        name  = "EMAIL_DRIVER"
        value = var.email_driver
      }
      env {
        name  = "EMAIL_FROM_ADDRESS"
        value = var.email_from_address
      }
      env {
        name  = "BILLING_DRIVER"
        value = var.billing_driver
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.this
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        # Next answers this before it has warmed anything, which is all a
        # start-up probe should require of it.
        tcp_socket {
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.this,
    google_secret_manager_secret_version.this,
    google_secret_manager_secret_iam_member.run_secrets,
    google_firestore_database.this,
  ]

  lifecycle {
    ignore_changes = [
      # Cloud Run stamps these on every deploy. Terraform re-writing them would
      # make every plan show a diff that means nothing.
      client,
      client_version,
    ]
  }
}

# A public website. Authorization happens inside the app, per request, against
# the caller's session — not at the edge, because most of the site is meant to
# be reachable by someone who has only been handed a link.
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

/**
 * The custom domain.
 *
 * Created only once `site_url` names one. Cloud Run's own domain mapping rather than a
 * load balancer: a global HTTPS load balancer is roughly $18 a month standing charge for
 * capability this does not need, and mapping is free and manages its own certificate.
 *
 * The domain has to be verified to the project first — Terraform cannot do that, and the
 * apply fails with a clear message until it is. See docs/DEPLOYMENT.md.
 */
resource "google_cloud_run_domain_mapping" "custom" {
  count = local.custom_domain != "" ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = local.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
