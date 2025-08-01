resource "aws_security_group" "cra_upd_ecs_data_import_sg" {
  name        = "cra-upd-ecs-data-import-sg"
  description = "ECS Security Group for CRA UPD data import"
  vpc_id      = var.vpc_id
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
