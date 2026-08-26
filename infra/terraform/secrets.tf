# ---------------------------------------------------------------------------
# Secrets.
#
# Generated here rather than typed by a person, so nothing secret ever passes
# through a terminal, a chat window, or a repository. Cloud Run reads them at
# start-up; they are never build arguments and never land in an image layer.
# ---------------------------------------------------------------------------

/**
 * Mixed into join-code hashes before they become document IDs, so a dump of the
 * `joinCodes` collection is not a list of working codes.
 *
 * Rotating this invalidates every outstanding code — which is why it is marked
 * to be kept rather than regenerated on drift.
 */
resource "random_password" "join_code_pepper" {
  length  = 64
  special = false

  lifecycle {
    ignore_changes = all
  }
}

/** Bearer token Cloud Scheduler presents to the cleanup endpoint. */
resource "random_password" "cleanup_task_secret" {
  length  = 48
  special = false

  lifecycle {
    ignore_changes = all
  }
}

locals {
  secrets = {
    JOIN_CODE_PEPPER    = random_password.join_code_pepper.result
    CLEANUP_TASK_SECRET = random_password.cleanup_task_secret.result
  }
}

resource "google_secret_manager_secret" "this" {
  for_each = local.secrets

  project   = var.project_id
  secret_id = "${var.service_name}-${lower(replace(each.key, "_", "-"))}"

  replication {
    # Single region, matching everything else. Automatic replication would
    # copy the secret into regions this stack does not otherwise use.
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = local.secrets

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value
}
