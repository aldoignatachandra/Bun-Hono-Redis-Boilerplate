# 2-Node Kafka KRaft Cluster Guide

This setup provides a **lightweight, distributed Kafka cluster** using **KRaft** (Kafka Raft Metadata mode), designed for local development where resources (RAM/CPU) are limited. It removes the dependency on ZooKeeper and runs 2 Brokers instead of the standard 3.

**Update:** This configuration now uses `confluentinc/cp-kafka:latest` which offers excellent stability on **Apple Silicon (M1/M2/M3)** and other ARM64 architectures.

## Architecture

### 1. 2-Node Cluster

We run 2 Brokers (`kafka-1`, `kafka-2`).

- **Why 2 Nodes?**
  - **Resource Efficiency**: Significantly lighter on Docker Desktop than a 3-node cluster.
  - **Distributed Learning**: You still get to experience multi-node concepts (replication, load balancing, connection strings) without the overhead of a full quorum.

- **The "Split Brain" Trade-off**:
  - In a standard distributed system, you need an odd number of nodes (3, 5, 7) to reach a majority (quorum) for leader election.
  - With 2 nodes, if **1 node fails**, the cluster might lose its ability to elect a new controller (since a majority of 2 is 2).
  - **Impact**: In this dev setup, if you stop one container, you might not be able to create _new_ topics, but existing partition leaders on the surviving node should still function. This is an acceptable trade-off for a local learning environment.

### 2. Replication Factor = 2

- **Data Safety**: Every message is copied to **both** nodes.
- **Configuration**: `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 2`
- **Result**: If `kafka-1` crashes, `kafka-2` has a copy of the data.

### 3. Min In-Sync Replicas (ISR) = 1

- **Availability**: We allow writes even if only **1 node** is online.
- **Why?** In a 2-node cluster, if we required 2 ISR and one node went down (e.g., for a restart), the entire cluster would become read-only (rejecting writes). Setting this to 1 ensures you can keep developing even if one broker is offline.

## Load Balancing Explained

Kafka does not use a traditional "Load Balancer" (like Nginx) for data traffic. Instead:

1.  **Client-Side Balancing (Smart Clients)**:
    - The **Producer** (your code) connects to any broker in the `KAFKA_BROKERS` list.
    - It downloads the **Metadata** (cluster map) which says "Partition 0 is on Kafka-1, Partition 1 is on Kafka-2".
    - The client then sends data directly to the correct **Leader** broker.
    - **Round Robin**: By default, producers cycle through partitions, spreading load across all brokers automatically.

2.  **Cluster Auto-Balancing**:
    - In this setup, partitions are distributed across `kafka-1` and `kafka-2`.

## Connection Guide

| Service     | Internal (Docker Network) | External (Localhost) |
| :---------- | :------------------------ | :------------------- |
| **Kafka 1** | `kafka-1:9092`            | `localhost:19092`    |
| **Kafka 2** | `kafka-2:9092`            | `localhost:29092`    |

### Service Configuration (.env)

When configuring your services (Product, User, Auth), use the external addresses:

```env
KAFKA_BROKERS=localhost:19092,localhost:29092
```

## How to Run

1.  **Start the Cluster**:

    ```bash
    # IMPORTANT: If you previously ran with Bitnami image, clear volumes first to avoid format errors:
    # docker-compose -f infra/kafka/docker-compose.yml down -v
    
    npm run kafka:up
    # OR
    bun run kafka:up
    ```

2.  **Verify Status**:

    ```bash
    docker ps
    ```

3.  **Access UI**:
    - Open [http://localhost:8080](http://localhost:8080) to see the Kafka UI.
    - You should see "Online" with 2 Brokers.

## Useful Commands

**Check Logs**:

```bash
docker logs -f kafka-1
```

**Create a Topic Manually** (if needed):

```bash
docker exec kafka-1 kafka-topics --create --topic test-topic --partitions 3 --replication-factor 2 --bootstrap-server kafka-1:9092
```

**Note on Apple Silicon**:
We are using `confluentinc/cp-kafka:latest` to ensure compatibility with Mac OS Sonoma and Apple Silicon chips. This image handles KRaft mode via the `CLUSTER_ID` environment variable.
