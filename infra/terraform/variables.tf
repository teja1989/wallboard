variable "project_id" {
  description = "GCP project ID the whole stack lives in."
  type        = string
}

variable "region" {
  description = <<-EOT
    Region for Cloud Run, Cloud Storage and Firestore. Keep all three in the
    same region: cross-region reads are billed as network egress, and the media
    bucket is the one thing this app moves in volume.
  EOT
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name. Also the Artifact Registry image name."
  type        = string
  default     = "marquee"
}

variable "image" {
  description = <<-EOT
    Fully-qualified container image to deploy, digest-pinned by CI. Empty on the
    very first apply, when the service is created from a placeholder image
    because the real one cannot be pushed before the registry exists.
  EOT
  type        = string
  default     = ""
}

variable "owner_emails" {
  description = "Comma-separated. These accounts are promoted to OWNER on first sign-in."
  type        = string
}

variable "site_url" {
  description = <<-EOT
    Public origin of the site, without a trailing slash. Leave empty to use the
    service's own run.app URL, which is what a deploy with no custom domain
    wants. Set it once a domain is mapped.
  EOT
  type        = string
  default     = ""
}

variable "google_oauth_client_id" {
  description = <<-EOT
    OAuth 2.0 Web client ID for Google sign-in. Creating the client and its consent screen
    is console work Terraform has no API for; wiring the result up is not, and doing it
    here rather than by clicking in the Firebase console keeps the next apply from being
    the thing that quietly reverts it.
  EOT
  type        = string
  default     = ""
}

variable "google_oauth_client_secret" {
  description = "Secret for that client. Comes from a GitHub Secret, never a variable."
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_sign_in" {
  description = <<-EOT
    Whether to offer the Google button. Requires the OAuth client above: turning this on
    without one puts a button on the page that fails with `auth/operation-not-allowed` the
    first time anyone presses it, so the two are checked together at plan time.
  EOT
  type        = bool
  default     = false
}

variable "email_driver" {
  description = "outbox | resend. `outbox` writes mail to Firestore instead of sending it."
  type        = string
  default     = "outbox"

  validation {
    condition     = contains(["outbox", "resend"], var.email_driver)
    error_message = "email_driver must be outbox or resend."
  }

  validation {
    # Failing here beats failing at boot, where the symptom is a service that will not start
    # and a log line nobody is watching for.
    condition     = var.email_driver != "resend" || var.resend_api_key != ""
    error_message = "email_driver = resend needs resend_api_key to be set."
  }
}

variable "resend_api_key" {
  description = "Resend API key. Required when email_driver is resend; empty keeps mail in the outbox."
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from_address" {
  description = "Who invitations come from. Must be on a domain verified with the provider."
  type        = string
  default     = "invitations@marqueersvp.com"
}

variable "billing_driver" {
  description = "mock | stripe. Real money needs `stripe` plus the four Stripe secrets."
  type        = string
  default     = "mock"

  validation {
    condition     = contains(["mock", "stripe"], var.billing_driver)
    error_message = "billing_driver must be mock or stripe."
  }
}

variable "min_instances" {
  description = <<-EOT
    Keep at 0. A scale-to-zero service costs nothing while idle, which is the
    entire cost argument for Cloud Run on a product with bursty, event-shaped
    traffic. Raise it only if cold starts become a measured problem.
  EOT
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Ceiling on concurrent instances. This is the runaway-bill brake."
  type        = number
  default     = 4
}

variable "billing_account" {
  description = "Billing account ID for the budget alert. Empty disables the budget."
  type        = string
  default     = ""
}

variable "budget_amount_usd" {
  description = "Monthly budget in USD. Alerts fire at 50/90/100% of it."
  type        = number
  default     = 25
}

variable "budget_alert_emails" {
  description = <<-EOT
    Comma-separated addresses notified when the budget thresholds trip. A string
    rather than a list because it arrives from a GitHub Actions variable, and
    quoting a HCL list through a shell is a source of bugs and nothing else.
  EOT
  type        = string
  default     = ""
}

variable "media_retention_days" {
  description = <<-EOT
    Bucket lifecycle backstop. The cleanup sweep deletes an expired event's
    objects within hours; this deletes anything the sweep ever missed, so a bug
    cannot turn into rent paid forever.
  EOT
  type        = number
  default     = 90
}
