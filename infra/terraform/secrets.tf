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
   * Which secrets exist, decided by the driver rather than by looking at the key.
   *
   * This split matters. `for_each` keys may not be derived from a sensitive value, and
   * asking `var.resend_api_key == ""` makes the *existence of the key* depend on a secret —
   * which Terraform rejects for the whole plan, not just that expression. `email_driver` is
   * an ordinary string, and the variable validation already guarantees the two agree.
   *
   * Only created when actually in use: an empty Secret Manager version would make Cloud Run
   * fail to start, which is worse than the feature staying switched off.
   */
  supplied_secret_names = concat(
    var.email_driver == "resend" ? ["RESEND_API_KEY"] : [],
    # Same rule as above: presence is decided by a plain variable, never by inspecting the
    # secret. `!= ""` on a sensitive value would poison the whole for_each.
    var.places_enabled ? ["GOOGLE_MAPS_API_KEY"] : [],
  )

  secret_names = concat(keys(local.generated_secrets), local.supplied_secret_names)

  # Every value, including ones not currently in `secret_names`. Looked up by name, so an
  # unused empty string is never written anywhere.
  secret_values = merge(local.generated_secrets, {
    RESEND_API_KEY      = var.resend_api_key
    GOOGLE_MAPS_API_KEY = var.google_maps_api_key
  })
}

resource "google_secret_manager_secret" "this" {
  for_each = toset(local.secret_names)

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
  for_each = toset(local.secret_names)

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = local.secret_values[each.key]
}
