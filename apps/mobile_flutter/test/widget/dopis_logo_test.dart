import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dopis_mobile/widgets/dopis_logo.dart';

void main() {
  testWidgets('DopisLogo renders with default dimensions', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(child: DopisLogo()),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(DopisLogo), findsOneWidget);
    final size = tester.getSize(find.byType(DopisLogo));
    expect(size.width, 120.0);
    expect(size.height, 57.6);
  });

  testWidgets('DopisLogo renders with custom dimensions and color',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Center(
            child: DopisLogo(
              width: 200,
              height: 96,
              color: Color(0xFF2B4E85),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(DopisLogo), findsOneWidget);
    final size = tester.getSize(find.byType(DopisLogo));
    expect(size.width, 200.0);
    expect(size.height, 96.0);
  });

  testWidgets('DopisLogoPainter paints on canvas without error',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: CustomPaint(
              size: const Size(100, 48),
              painter: const DopisLogoPainter(),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CustomPaint), findsWidgets);
  });
}
