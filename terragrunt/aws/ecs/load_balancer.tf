# 
# Application Load Balancer for ECS
#

resource "aws_lb" "cra_upd_ecs_alb" {
  load_balancer_type = "application"
  internal           = true
  subnets            = var.vpc_private_subnet_ids
  security_groups    = [aws_security_group.cra_upd_loadbalancer_sg.id]
}

resource "aws_lb_target_group" "cra_upd_ecs_lb_target_group" {
  port        = 9000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    path                = "/api/_healthcheck"
    port                = "traffic-port"
    interval            = 60
    timeout             = 30
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "cra_upd_ecs_alb_listener" {
  load_balancer_arn = aws_lb.cra_upd_ecs_alb.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cra_upd_ecs_lb_target_group.arn
  }
}