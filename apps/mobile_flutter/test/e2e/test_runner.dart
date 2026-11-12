import 'package:flutter_test/flutter_test.dart';
import 'tier1_feature_test.dart' as tier1;
import 'tier2_boundary_test.dart' as tier2;
import 'tier3_pairwise_test.dart' as tier3;
import 'tier4_workload_test.dart' as tier4;
import 'tier5_adversarial_test.dart' as tier5;

/// Master Test Runner executing all 5 E2E tiers sequentially.
void main() {
  group('=== DOPIS MOBILE CLIENT MASTER E2E TEST SUITE ===', () {
    group('Tier 1: Feature Coverage Tests', tier1.main);
    group('Tier 2: Boundary & Corner Case Tests', tier2.main);
    group('Tier 3: Pairwise Combinatorial Tests', tier3.main);
    group('Tier 4: Real-World Workload Workflows', tier4.main);
    group('Tier 5: Adversarial Coverage Hardening', tier5.main);
  });
}
