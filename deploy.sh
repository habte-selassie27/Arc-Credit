#!/bin/bash
# ArcCredit Contract Deployment Script
# Uses forge create — no forge-std dependency required
set -e

# Load environment
source .env 2>/dev/null || { echo "Error: .env not found. Copy .env.example to .env and fill in DEPLOYER_PRIVATE_KEY"; exit 1; }

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
  echo "Error: DEPLOYER_PRIVATE_KEY not set in .env"
  exit 1
fi

RPC="https://rpc.testnet.arc.io"
VERIFY="--verify --etherscan-api-key placeholder"

echo "=== Deploying ArcCredit Contracts ==="
echo "RPC: $RPC"
echo ""

# 1. CreditScoreRegistry
echo "[1/7] Deploying CreditScoreRegistry..."
SCORE_REGISTRY=$(forge create contracts/src/CreditScoreRegistry.sol:CreditScoreRegistry \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  --constructor-args \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $SCORE_REGISTRY"

# Initialize
echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $SCORE_REGISTRY \
  --sig "initialize(address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) \
  --broadcast 2>/dev/null

# 2. ScoreOracle
echo "[2/7] Deploying ScoreOracle..."
SCORE_ORACLE=$(forge create contracts/src/ScoreOracle.sol:ScoreOracle \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $SCORE_ORACLE"

echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $SCORE_ORACLE \
  --sig "initialize(address,address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) $SCORE_REGISTRY \
  --broadcast 2>/dev/null

# 3. CreditLine
echo "[3/7] Deploying CreditLine..."
CREDIT_LINE=$(forge create contracts/src/CreditLine.sol:CreditLine \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $CREDIT_LINE"

echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $CREDIT_LINE \
  --sig "initialize(address,address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) $SCORE_REGISTRY \
  --broadcast 2>/dev/null

# 4. TranchManager
echo "[4/7] Deploying TranchManager..."
TRANCHE_MANAGER=$(forge create contracts/src/TranchManager.sol:TranchManager \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  --constructor-args 0x1000000000000000000000000000000000000001 \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $TRANCHE_MANAGER"

echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $TRANCHE_MANAGER \
  --sig "initialize(address,address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) 0x1000000000000000000000000000000000000001 \
  --broadcast 2>/dev/null

# 5. LoanVault
echo "[5/7] Deploying LoanVault..."
LOAN_VAULT=$(forge create contracts/src/LoanVault.sol:LoanVault \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $LOAN_VAULT"

echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $LOAN_VAULT \
  --sig "initialize(address,address,address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) 0x1000000000000000000000000000000000000001 $CREDIT_LINE \
  --broadcast 2>/dev/null

# 6. RepaymentScheduler
echo "[6/7] Deploying RepaymentScheduler..."
SCHEDULER=$(forge create contracts/src/RepaymentScheduler.sol:RepaymentScheduler \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url $RPC \
  $VERIFY 2>&1 | grep "Deployed to:" | awk '{print $NF}')
echo "  -> $SCHEDULER"

echo "  Initializing..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $SCHEDULER \
  --sig "initialize(address,address,address)" \
  $(cast wallet address $DEPLOYER_PRIVATE_KEY) $LOAN_VAULT $SCORE_REGISTRY \
  --broadcast 2>/dev/null

# 7. Wire permissions
echo "[7/7] Wiring permissions..."
echo "  Setting ScoreOracle as authorized oracle..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $SCORE_REGISTRY \
  --sig "setOracle(address,bool)" \
  $SCORE_ORACLE true \
  --broadcast 2>/dev/null

echo "  Setting LoanVault as authorized vault on CreditLine..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $CREDIT_LINE \
  --sig "setVault(address,bool)" \
  $LOAN_VAULT true \
  --broadcast 2>/dev/null

echo "  Setting RepaymentScheduler on LoanVault..."
forge tx --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC \
  --to $LOAN_VAULT \
  --sig "setRepaymentScheduler(address)" \
  $SCHEDULER \
  --broadcast 2>/dev/null

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Copy these addresses into your .env files:"
echo ""
echo "CREDIT_SCORE_REGISTRY_ADDRESS=$SCORE_REGISTRY"
echo "SCORE_ORACLE_ADDRESS=$SCORE_ORACLE"
echo "CREDIT_LINE_ADDRESS=$CREDIT_LINE"
echo "TRANCHE_MANAGER_ADDRESS=$TRANCHE_MANAGER"
echo "LOAN_VAULT_ADDRESS=$LOAN_VAULT"
echo "REPAYMENT_SCHEDULER_ADDRESS=$SCHEDULER"
