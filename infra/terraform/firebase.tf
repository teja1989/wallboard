# ---------------------------------------------------------------------------
# Firebase and Identity Platform.
#
# The app authenticates people with Firebase Auth, so the project has to be a
# Firebase project and there has to be a registered web app to read the client
# config from. Doing that here rather than in the console means the values that
# get baked into the browser bundle come from the same place as everything else.
# ---------------------------------------------------------------------------

resource "google_firebase_project" "this" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.this]
}

resource "google_firebase_web_app" "this" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Marquee"

  # Destroying the web app would invalidate the API key baked into every
  # deployed bundle, so it is deleted rather than abandoned only on purpose.
  deletion_policy = "DELETE"

  depends_on = [google_firebase_project.this]
}

data "google_firebase_web_app_config" "this" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.this.app_id
}

/**
 * Sign-in methods.
 *
 * Email link only. Google sign-in needs an OAuth client and a reviewed consent
 * screen, neither of which has a sane Terraform representation — `var.google_sign_in`
 * exists so the button appears once that is done by hand.
 */
resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled = true
      # The whole point is the emailed link; a password would be a second
      # credential to store, leak and reset.
      password_required = false
    }
  }

  # Redirect targets Firebase will honour for the sign-in link. Anything not
  # listed here cannot complete a sign-in, which is what stops a link being
  # replayed against an attacker's page.
  authorized_domains = distinct(compact([
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    replace(replace(local.site_url, "https://", ""), "http://", ""),
  ]))

  depends_on = [
    google_firebase_project.this,
    google_project_service.this,
  ]
}
