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
  # The generated ones. Nothing secret passes through a terminal or a chat window.
  generated_secrets = {
    JOIN_CODE_PEPPER    = random_password.join_code_pepper.result
    CLEANUP_TASK_SECRET = random_password.cleanup_task_secret.result
  }

  /**
   * Secrets that come from outside, and so cannot be generated.
   *
   * Only included when actually supplied: an empty Secret Manager version would make Cloud
   * Run fail to start, which is a worse outcome than the feature staying switched off.
   */
  supplied_secrets = var.resend_api_key == "" ? {} : { RESEND_API_KEY = var.resend_api_key }

  secrets = merge(local.generated_secrets, local.supplied_secrets)
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
