# ---------------------------------------------------------------------------
# Firestore: the database, the composite indexes the app queries need, the TTL
# policies that make expiry automatic, and the security rules.
#
# Regional rather than multi-region. A multi-region database is roughly five
# times the price per operation and buys availability this product does not
# need — an event wall being briefly unreachable is not a data-loss event.
# ---------------------------------------------------------------------------

resource "google_firestore_database" "this" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # A `terraform destroy` must not be able to take the guest data with it.
  # Deleting the database is a deliberate, console-confirmed act.
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.this]
}

locals {
  # Mirrors firestore.indexes.json. Kept as data rather than seven near-identical
  # resource blocks so adding an index is one line in one place.
  composite_indexes = {
    posts_visible_recent = {
      collection = "posts"
      fields = [
        { path = "state", order = "ASCENDING" },
        { path = "createdAt", order = "DESCENDING" },
      ]
    }
    events_by_host = {
      collection = "events"
      fields = [
        { path = "hostUid", order = "ASCENDING" },
        { path = "status", order = "ASCENDING" },
        { path = "createdAt", order = "DESCENDING" },
      ]
    }
    events_sweepable = {
      collection = "events"
      fields = [
        { path = "status", order = "ASCENDING" },
        { path = "expiresAt", order = "ASCENDING" },
      ]
    }
    # Live events close enough to the day to need a reminder. Two range filters on
    # `startsAt` sit on one field, so this is a single index rather than two — and
    # the range field goes last, which is the whole rule for reading these.
    events_upcoming = {
      collection = "events"
      fields = [
        { path = "status", order = "ASCENDING" },
        { path = "startsAt", order = "ASCENDING" },
      ]
    }
    audit_by_event = {
      collection = "auditLogs"
      fields = [
        { path = "eventId", order = "ASCENDING" },
        { path = "at", order = "DESCENDING" },
      ]
    }
    members_by_role = {
      collection = "members"
      fields = [
        { path = "role", order = "ASCENDING" },
        { path = "joinedAt", order = "ASCENDING" },
      ]
    }
    members_by_rsvp = {
      collection = "members"
      fields = [
        { path = "rsvp.status", order = "ASCENDING" },
        { path = "joinedAt", order = "ASCENDING" },
      ]
    }
    # The active-event limit checked when a host creates one: equality on host and
    # status, range on expiry. The range field has to come last, which is why the
    # events_by_host index above cannot serve it — and why creating an event returned
    # a 500 in production while passing every test, since the emulator does not
    # enforce composite indexes at all.
    events_active_for_host = {
      collection = "events"
      fields = [
        { path = "hostUid", order = "ASCENDING" },
        { path = "status", order = "ASCENDING" },
        { path = "expiresAt", order = "ASCENDING" },
      ]
    }
    # The cleanup sweep looking for live events old enough to have abandoned uploads.
    events_stale_live = {
      collection = "events"
      fields = [
        { path = "status", order = "ASCENDING" },
        { path = "createdAt", order = "ASCENDING" },
      ]
    }
    events_for_host = {
      collection = "events"
      fields = [
        { path = "hostUid", order = "ASCENDING" },
        { path = "createdAt", order = "DESCENDING" },
      ]
    }
    events_by_host_date = {
      collection = "events"
      fields = [
        { path = "hostUid", order = "ASCENDING" },
        { path = "startsAt", order = "DESCENDING" },
      ]
    }
  }

  # The document field each collection's TTL policy watches. Firestore deletes a
  # document once the timestamp in this field is in the past, which is what makes
  # expiry happen without anything having to run.
  ttl_fields = {
    events     = "expiresAtTtl"
    posts      = "expiresAtTtl"
    joinCodes  = "expiresAt"
    rateLimits = "expiresAt"
  }
}

resource "google_firestore_index" "composite" {
  for_each = local.composite_indexes

  project     = var.project_id
  database    = google_firestore_database.this.name
  collection  = each.value.collection
  query_scope = "COLLECTION"

  dynamic "fields" {
    for_each = each.value.fields
    content {
      field_path = fields.value.path
      order      = fields.value.order
    }
  }
}

resource "google_firestore_field" "ttl" {
  for_each = local.ttl_fields

  project    = var.project_id
  database   = google_firestore_database.this.name
  collection = each.key
  field      = each.value

  ttl_config {}

  # Deliberately empty: it disables the automatic single-field indexes on this
  # field. Nothing queries these timestamps — the TTL policy reads them directly
  # — so indexing them would buy nothing and cost an index write on every single
  # post, event and rate-limit token.
  index_config {}
}

# ---------------------------------------------------------------------------
# Security rules.
#
# Deployed from the same files the rules tests run against, so what CI proves is
# what production enforces. The app writes nothing from the client, so these are
# a second lock rather than the only one — see docs/SECURITY.md.
# ---------------------------------------------------------------------------

resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../../firestore.rules")
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_firestore_database.this,
    google_firebase_project.this,
  ]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.firestore]
  }
}
