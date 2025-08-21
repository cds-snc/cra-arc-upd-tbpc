#!/usr/bin/env bash

# Function to display usage information
usage() {
    echo "Usage: $0 <task-name> [cluster-name] [service-name]"
    echo ""
    echo "Arguments:"
    echo "  task-name     Required. The name of the ECS task definition to run"
    echo "  cluster-name  Optional. The ECS cluster name (default: {task-name}-cluster)"
    echo "  service-name  Optional. The ECS service name (default: {task-name}-service)"
    echo ""
    echo "Examples:"
    echo "  $0 my-task"
    echo "  $0 my-task my-cluster"
    echo "  $0 my-task my-cluster my-service"
    exit 1
}

# Check if at least one argument is provided
if [ $# -lt 1 ]; then
    echo "Error: Task name is required."
    usage
fi

# Parse command line arguments
taskName="$1"
clusterName="${2:-${taskName}-cluster}"
serviceName="${3:-${taskName}-service}"

echo "Running ECS task with the following configuration:"
echo "  Task Definition: $taskName"
echo "  Cluster: $clusterName"
echo "  Service: $serviceName"
echo ""

# Get network configuration from existing service
echo "Retrieving network configuration from service..."
networkConfiguration=$(
  aws ecs describe-services \
    --cluster "$clusterName" \
    --services "$serviceName" \
    --query "services[0].deployments[0].networkConfiguration" 2>/dev/null
)

if [ $? -ne 0 ] || [ "$networkConfiguration" == "None" ]; then
  echo "Error: Failed to retrieve network configuration from service $serviceName."
  exit 1
fi

echo "Attempting to run the ECS task..."

# Run the task with or without network configuration
aws ecs run-task \
    --cluster "$clusterName" \
    --task-definition "$serviceName" \
    --launch-type FARGATE \
    --network-configuration "$networkConfiguration" \
    --output text >/dev/null

if [ $? -ne 0 ]; then
  echo "Failed to run the ECS task."
  exit 1
fi

echo "ECS task initializing."

# Wait for resources to be provisioned for the ECS task
sleep 5

echo "Fetching task details..."
taskArn=$(
  aws ecs list-tasks \
    --cluster "$clusterName" \
    --query "taskArns[0]" \
    --output text
)

echo "Task ARN: $taskArn"

if [ -z "$taskArn" ] || [ "$taskArn" == "None" ]; then
  echo "No task found in cluster $clusterName."
  exit 1
fi

echo "Waiting for the ECS task to start..."

aws ecs wait tasks-running --cluster "$clusterName" --tasks "$taskArn"
if [ $? -ne 0 ]; then
  echo "Failed to wait for the ECS task to start."
  exit 1
fi

echo "Successfully started the ECS task."