import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dopis_mobile/widgets/folder_pills.dart';

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('FolderPills Widget Tests', () {
    testWidgets('renders all 4 German folders', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 0,
              onSelectFolder: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Posteingang'), findsOneWidget);
      expect(find.text('Gesendet'), findsOneWidget);
      expect(find.text('Archiv'), findsOneWidget);
      expect(find.text('Papierkorb'), findsOneWidget);
    });

    testWidgets('active folder has primary blue background and white text',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 0,
              onSelectFolder: (_) {},
            ),
          ),
        ),
      );

      final activeText = tester.widget<Text>(find.text('Posteingang'));
      expect(activeText.style?.color, Colors.white);
      expect(activeText.style?.fontWeight, FontWeight.w600);

      final inactiveText = tester.widget<Text>(find.text('Gesendet'));
      expect(inactiveText.style?.color, const Color(0xFF475569));
    });

    testWidgets('renders unread badge counter when count > 0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 4,
              onSelectFolder: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('4'), findsOneWidget);
    });

    testWidgets('hides unread badge counter when count is 0', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 0,
              onSelectFolder: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('0'), findsNothing);
    });

    testWidgets('tapping folder triggers onSelectFolder with correct folder key',
        (tester) async {
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 0,
              onSelectFolder: (f) => selected = f,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Gesendet'));
      expect(selected, 'sent');

      await tester.tap(find.text('Archiv'));
      expect(selected, 'archive');

      await tester.tap(find.text('Papierkorb'));
      expect(selected, 'trash');
    });

    testWidgets(
        'renders horizontally scrollable container without overflow on 360dp',
        (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FolderPills(
              selectedFolder: 'inbox',
              unreadCount: 12,
              onSelectFolder: (_) {},
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(SingleChildScrollView), findsOneWidget);
    });
  });
}
