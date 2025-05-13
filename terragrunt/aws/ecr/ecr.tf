resource "aws_ecr_repository" "cra_upd_ecr" {
  name                 = var.product_name_dashed
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}