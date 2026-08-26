data "google_project" "this" {
  project_id = var.project_id
}

locals {
  # The bootstrap script enables what Terraform itself needs to run. These are the
  # APIs the application needs, kept here so the stack is reproducible from code.
  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "firebaserules.googleapis.com",
    "firebasestorage.googleapis.com",
    "identitytoolkit.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    # V4 signed URLs from Cloud Run have no private key to sign with, so the SDK
    # signs through this API instead. Without it, every upload and every photo
    # on the wall fails.
    "iamcredentials.googleapis.com",
    "monitoring.googleapis.com",
  ]

  /**
   * Where the site answers.
   *
   * This cannot read `google_cloud_run_v2_service.app.uri`, however much it
   * would like to: the service's own environment and the bucket's CORS policy
   * both need the origin, so referring to the service here would make the
   * service depend on itself and Terraform would refuse the graph.
   *
   * Cloud Run URLs are deterministic — service name, project number, region —
   * so the origin is derived instead. The deploy workflow compares this against
   * the URL the service actually got and re-applies with the real one if they
   * ever disagree, so a change in Google's URL format costs one extra apply
   * rather than a broken site.
   */
  predicted_url = "https://${var.service_name}-${data.google_project.this.number}.${var.region}.run.app"
  site_url      = var.site_url != "" ? var.site_url : local.predicted_url

  # The very first apply runs before any image has been pushed, because the
  # registry it would be pushed to does not exist yet. Google's own sample
  # container stands in for exactly one apply; CI passes the real image on the
  # second one, and every apply after that.
  image = var.image != "" ? var.image : "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_project_service" "this" {
  for_each = toset(local.services)

  project = var.project_id
  service = each.value

  # Leave the APIs on when the stack is torn down. Disabling them would take
  # anything else in the project down with it.
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = var.service_name
  format        = "DOCKER"
  description   = "Container images for the ${var.service_name} Cloud Run service."

  # Images are cheap but not free, and CI pushes one per commit. Keeping the
  # last ten is enough to roll back and stops the registry growing forever.
  # A KEEP policy on its own deletes nothing — it only protects images from a
  # DELETE policy. Both are needed: delete anything older than 30 days, except
  # the ten most recent, which stay available to roll back to.
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.this]
}
