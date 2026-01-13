# 
# Application Load Balancer for ECS
#

locals {
  # Without a valid domain/certificate, we need to use regular HTTP
  # If validate_domain is false, the ALB will be non-functional, but allows for a successful deployment
  listener_options = var.validate_domain ? {
    port            = 443
    protocol        = "HTTPS"
    ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-Res-2021-06"
    certificate_arn = var.loadbalancer_certificate_arn
    } : {
    port            = 80
    protocol        = "HTTP"
    ssl_policy      = null
    certificate_arn = null
  }
}

resource "aws_lb" "cra_upd_ecs_alb" {
  load_balancer_type = "application"
  internal           = true
  idle_timeout       = 300
  subnets            = var.vpc_private_subnet_ids
  security_groups    = [aws_security_group.cra_upd_loadbalancer_sg.id]
}

resource "aws_lb_target_group" "cra_upd_ecs_lb_target_group" {
  port                              = 9000
  protocol                          = "HTTP"
  target_type                       = "ip"
  vpc_id                            = var.vpc_id
  load_balancing_cross_zone_enabled = false

  deregistration_delay = 30

  health_check {
    path                = "/api/_healthcheck"
    port                = "traffic-port"
    interval            = 60
    timeout             = 15
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "cra_upd_ecs_alb_listener" {
  load_balancer_arn = aws_lb.cra_upd_ecs_alb.arn
  port              = local.listener_options.port
  protocol          = local.listener_options.protocol
  ssl_policy        = local.listener_options.ssl_policy
  certificate_arn   = local.listener_options.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cra_upd_ecs_lb_target_group.arn
  }
}
