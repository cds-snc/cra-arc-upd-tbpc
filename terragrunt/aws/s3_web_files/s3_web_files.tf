resource "aws_s3_object" "cra_upd_web_resources" {
  for_each = fileset(var.web_resources_build_path, "**")

  bucket = var.bucket_id
  key    = each.key
  source = "${var.web_resources_build_path}/${each.value}"
  etag   = filemd5("${var.web_resources_build_path}/${each.value}")
}