locals {
  content_types = {
    ".html"  = "text/html"
    ".css"   = "text/css"
    ".js"    = "application/javascript"
    ".json"  = "application/json"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"   = "font/ttf"
    ".eot"   = "font/eot"
    ".ico"   = "image/x-icon"
    ".txt"   = "text/plain"
  }

  files = fileset(var.web_resources_build_path, "**")

  files_with_content_types = {
    for file in local.files :
    file => lookup(local.content_types, regex("\\.[^.]*$", file), "application/octet-stream")
  }
}

resource "aws_s3_object" "cra_upd_web_resources" {
  for_each = local.files_with_content_types

  bucket       = var.bucket_id
  key          = each.key
  source       = "${var.web_resources_build_path}/${each.key}"
  etag         = filemd5("${var.web_resources_build_path}/${each.key}")
  content_type = each.value

  lifecycle {
    prevent_destroy = false
  }
}

resource "terraform_data" "clear_cloudfront_cache" {
  count = length(local.files_with_content_types) == 0 ? 0 : 1

  lifecycle {
    replace_triggered_by = [
      aws_s3_object.cra_upd_web_resources
    ]
  }

  depends_on = [aws_s3_object.cra_upd_web_resources]

  # Invalidate CloudFront cache after S3 object changes
  provisioner "local-exec" {
    command = "aws cloudfront create-invalidation --distribution-id ${var.cloudfront_distribution_id} --paths '/*'"
  }
}
