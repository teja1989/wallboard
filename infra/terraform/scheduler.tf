# ---------------------------------------------------------------------------
# The expiry sweep.
#
# Firestore TTL policies delete documents, but bytes in a bucket know nothing
# about them. Without this job an "ephemeral" event would leave its photos in
# storage indefinitely, which would make the central promise of the product
# false. It is the one piece of infrastructure the product's honesty depends on.
# ---------------------------------------------------------------------------

resource "google_cloud_scheduler_job" "cleanup" {
  project     = var.project_id
  region      = var.region
  name        = "${var.service_name}-cleanup"
  description = "Sweeps expired events' media and abandoned uploads out of the bucket."

  # Hourly. The sweep is bounded to 50 events per run, and an hourly cadence
  # clears a backlog quickly while staying far inside the free tier of three
  # jobs. Its own cost is nil; what it saves is storage rent.
  schedule  = "17 * * * *"
  time_zone = "Etc/UTC"

  attempt_deadline = "320s"

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.app.uri}/api/internal/cleanup"

    /**
     * A bearer secret rather than an OIDC token.
     *
     * The service has to be publicly invokable — it is a website — so Cloud Run
     * IAM cannot gate this one path, and an OIDC token would occupy the same
     * Authorization header the app checks. The shared secret is therefore the
     * lock, compared in constant time, and it lives in Secret Manager rather
     * than in this file.
     */
    headers = {
      "Authorization" = "Bearer ${random_password.cleanup_task_secret.result}"
      "Content-Type"  = "application/json"
    }
  }

  depends_on = [google_project_service.this]
}

# ---------------------------------------------------------------------------
# Reminders.
#
# The nudge to guests who have not replied existed already, and went out only
# when a host pressed a button on a tab they had to think to open. Most never
# did, which lost replies for reasons that had nothing to do with the
# invitation.
#
# Runs four times a day rather than hourly. A reminder slot is a day-scale
# thing, the job claims each slot transactionally before sending so a missed
# tick simply fires on the next one, and four ticks keeps the whole account
# inside Cloud Scheduler's free three-job tier alongside the sweep.
# ---------------------------------------------------------------------------

resource "google_cloud_scheduler_job" "reminders" {
  project     = var.project_id
  region      = var.region
  name        = "${var.service_name}-reminders"
  description = "Emails guests who have not replied, on a schedule counted back from the event."

  schedule  = "43 */6 * * *"
  time_zone = "Etc/UTC"

  attempt_deadline = "320s"

  # One retry, not two. Every attempt that gets far enough to claim a slot has
  # already sent; retrying harder buys nothing and risks more.
  retry_config {
    retry_count          = 1
    min_backoff_duration = "60s"
  }

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.app.uri}/api/internal/reminders"

    # The same shared task secret as the sweep — see src/lib/server/internal-task.ts
    # for why these endpoints share one lock rather than holding one each.
    headers = {
      "Authorization" = "Bearer ${random_password.cleanup_task_secret.result}"
      "Content-Type"  = "application/json"
    }
  }

  depends_on = [google_project_service.this]
}
