# ---------------------------------------------------------------------------
# The media bucket.
#
# Private, always. Nothing in it is ever public: the app hands out V4 signed
# URLs that expire, which is what makes removing someone from an event actually
# remove their access to the photos.
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "media" {
  project  = var.project_id
  name     = "${var.project_id}-${var.service_name}-media"
  location = upper(var.region)

  # Standard, not Nearline. Objects here are read constantly for a few days and
  # then deleted; Nearline's cheaper storage would be swamped by its per-read
  # retrieval fee and its 30-day minimum duration charge on objects that live
  # for three.
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Off. Versioning on a bucket whose entire purpose is deleting things on a
  # schedule would keep paying for every copy the sweep thought it had removed.
  versioning {
    enabled = false
  }

  # Soft delete defaults to a 7-day retention window, and soft-deleted objects
  # are billed as storage. For an app that deletes media on purpose that is a
  # bill for data nobody can read. Zero turns it off.
  soft_delete_policy {
    retention_duration_seconds = 0
  }

  # The backstop behind the cleanup sweep. The sweep deletes an expired event's
  # objects within hours of expiry; this catches anything it ever misses, so a
  # bug becomes a bounded cost rather than rent paid forever.
  lifecycle_rule {
    condition {
      age = var.media_retention_days
    }
    action {
      type = "Delete"
    }
  }

  # A browser that starts a direct upload and abandons it leaves a partial
  # multipart upload behind, which is billed and which nobody will ever
  # finalize. Versioning is off, so there are no noncurrent versions to sweep —
  # this is the rule that catches the real leak.
  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "AbortIncompleteMultipartUpload"
    }
  }

  # Uploads go straight from the browser to the bucket, and photos are fetched
  # from it directly, so the bucket itself has to accept cross-origin requests
  # from the site. PUT for the upload, GET/HEAD for the wall.
  cors {
    origin          = compact([local.site_url, "http://localhost:3000"])
    method          = ["GET", "HEAD", "PUT", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length", "x-goog-content-length-range"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.this]
}

# Registers the bucket with Firebase so storage.rules apply to it. The browser
# never uses the Storage SDK, so this is belt and braces — but a bucket Firebase
# does not know about is a bucket its rules cannot deny.
resource "google_firebase_storage_bucket" "media" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = google_storage_bucket.media.name

  depends_on = [google_firebase_project.this]
}

resource "google_firebaserules_ruleset" "storage" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "storage.rules"
      content = file("${path.module}/../../storage.rules")
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_firebase_storage_bucket.media]
}

resource "google_firebaserules_release" "storage" {
  provider     = google-beta
  project      = var.project_id
  name         = "firebase.storage/${google_storage_bucket.media.name}"
  ruleset_name = google_firebaserules_ruleset.storage.name

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.storage]
  }
}
