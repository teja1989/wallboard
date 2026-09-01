# ---------------------------------------------------------------------------
# Cost alerting.
#
# Optional, because it needs a billing account ID that a project ID does not
# imply. Skip it and everything else still works — but the failure mode of a
# public site with direct-to-bucket uploads is a bill nobody saw coming, and
# this is what turns that into an email.
# ---------------------------------------------------------------------------

locals {
  budget_enabled = var.billing_account != "" ? 1 : 0
  budget_emails  = toset(compact(split(",", replace(var.budget_alert_emails, " ", ""))))
}

resource "google_monitoring_notification_channel" "budget" {
  for_each = local.budget_enabled == 1 ? local.budget_emails : toset([])

  project      = var.project_id
  display_name = "Marquee budget alert (${each.value})"
  type         = "email"

  labels = {
    email_address = each.value
  }

  depends_on = [google_project_service.this]
}

resource "google_billing_budget" "this" {
  count = local.budget_enabled

  billing_account = var.billing_account
  display_name    = "${var.service_name} monthly"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  # Half, nearly all, and all. The 50% alert is the useful one: it arrives while
  # there is still time to find out what changed.
  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content {
      threshold_percent = threshold_rules.value
    }
  }

  all_updates_rule {
    monitoring_notification_channels = [
      for channel in google_monitoring_notification_channel.budget : channel.id
    ]
    disable_default_iam_recipients = false
  }
}
