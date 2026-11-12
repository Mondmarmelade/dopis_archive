import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Dopis vector logo widget rendering the signature brand logo (Envelope + Wordmark).
/// Supports asset loading with embedded SVG string fallback and pure CustomPainter.
class DopisLogo extends StatelessWidget {
  final double width;
  final double height;
  final Color? color;

  const DopisLogo({
    super.key,
    this.width = 120.0,
    this.height = 57.6, // Aspect ratio 100:48
    this.color,
  });

  /// Embedded raw SVG string from apps/web/src/icons/logo.svg
  static const String rawSvg = '''
<svg width="100" height="48" viewBox="0 0 100 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M67.5 13.5V34.5C67.5 35.6935 67.0259 36.8381 66.182 37.682C65.3381 38.5259 64.1935 39 63 39H33C31.8065 39 30.6619 38.5259 29.818 37.682C28.9741 36.8381 28.5 35.6935 28.5 34.5V13.5M67.5 13.5C67.5 12.3065 67.0259 11.1619 66.182 10.318C65.3381 9.47411 64.1935 9 63 9H33C31.8065 9 30.6619 9.47411 29.818 10.318C28.9741 11.1619 28.5 12.3065 28.5 13.5M67.5 13.5V13.986C67.5001 14.7543 67.3035 15.5098 66.9289 16.1806C66.5543 16.8514 66.0142 17.4151 65.36 17.818L50.36 27.048C49.6504 27.4851 48.8334 27.7165 48 27.7165C47.1666 27.7165 46.3496 27.4851 45.64 27.048L30.64 17.82C29.9858 17.4171 29.4457 16.8534 29.0711 16.1826C28.6965 15.5118 28.4999 14.7563 28.5 13.988V13.5" stroke="#3661A4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12.016 12.664C14.3627 12.664 16.4213 13.1227 18.192 14.04C19.984 14.9573 21.36 16.2693 22.32 17.976C23.3013 19.6613 23.792 21.624 23.792 23.864C23.792 26.104 23.3013 28.0667 22.32 29.752C21.36 31.416 19.984 32.7067 18.192 33.624C16.4213 34.5413 14.3627 35 12.016 35H4.208V12.664H12.016ZM11.856 31.192C14.2027 31.192 16.016 30.552 17.296 29.272C18.576 27.992 19.216 26.1893 19.216 23.864C19.216 21.5387 18.576 19.7253 17.296 18.424C16.016 17.1013 14.2027 16.44 11.856 16.44H8.688V31.192H11.856ZM75.1675 15.16C74.3782 15.16 73.7168 14.9147 73.1835 14.424C72.6715 13.912 72.4155 13.2827 72.4155 12.536C72.4155 11.7893 72.6715 11.1707 73.1835 10.68C73.7168 10.168 74.3782 9.912 75.1675 9.912C75.9568 9.912 76.6075 10.168 77.1195 10.68C77.6528 11.1707 77.9195 11.7893 77.9195 12.536C77.9195 13.2827 77.6528 13.912 77.1195 14.424C76.6075 14.9147 75.9568 15.16 75.1675 15.16ZM77.3755 17.272V35H72.8955V17.272H77.3755ZM88.5858 35.288C87.1351 35.288 85.8338 35.032 84.6818 34.52C83.5298 33.9867 82.6124 33.272 81.9298 32.376C81.2684 31.48 80.9058 30.488 80.8418 29.4H85.3538C85.4391 30.0827 85.7698 30.648 86.3458 31.096C86.9431 31.544 87.6791 31.768 88.5538 31.768C89.4071 31.768 90.0684 31.5973 90.5378 31.256C91.0284 30.9147 91.2738 30.4773 91.2738 29.944C91.2738 29.368 90.9751 28.9413 90.3778 28.664C89.8018 28.3653 88.8738 28.0453 87.5938 27.704C86.2711 27.384 85.1831 27.0533 84.3298 26.712C83.4978 26.3707 82.7724 25.848 82.1538 25.144C81.5564 24.44 81.2578 23.4907 81.2578 22.296C81.2578 21.3147 81.5351 20.4187 82.0898 19.608C82.6658 18.7973 83.4764 18.1573 84.5218 17.688C85.5884 17.2187 86.8364 16.984 88.2658 16.984C90.3778 16.984 92.0631 17.5173 93.3218 18.584C94.5804 19.6293 95.2738 21.048 95.4018 22.84H91.1138C91.0498 22.136 90.7511 21.5813 90.2178 21.176C89.7058 20.7493 89.0124 20.536 88.1378 20.536C87.3271 20.536 86.6978 20.6853 86.2498 20.984C85.8231 21.2827 85.6098 21.6987 85.6098 22.232C85.6098 22.8293 85.9084 23.288 86.5058 23.608C87.1031 23.9067 88.0311 24.216 89.2898 24.536C90.5698 24.856 91.6258 25.1867 92.4578 25.528C93.2898 25.8693 94.0044 26.4027 94.6018 27.128C95.2204 27.832 95.5404 28.7707 95.5618 29.944C95.5618 30.968 95.2738 31.8853 94.6978 32.696C94.1431 33.5067 93.3324 34.1467 92.2658 34.616C91.2204 35.064 89.9938 35.288 88.5858 35.288Z" fill="#3661A4"/>
</svg>''';

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? const Color(0xFF3661A4);
    return SizedBox(
      width: width,
      height: height,
      child: SvgPicture.string(
        rawSvg,
        width: width,
        height: height,
        fit: BoxFit.contain,
        colorFilter: color != null
            ? ColorFilter.mode(effectiveColor, BlendMode.srcIn)
            : null,
        placeholderBuilder: (context) => CustomPaint(
          size: Size(width, height),
          painter: DopisLogoPainter(color: effectiveColor),
        ),
      ),
    );
  }
}

/// Standalone fallback CustomPainter rendering vector paths without external assets.
class DopisLogoPainter extends CustomPainter {
  final Color color;

  const DopisLogoPainter({this.color = const Color(0xFF3661A4)});

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100.0, size.height / 48.0);

    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // 1. Envelope body (rounded rectangle: 28.5, 9.0, 39.0 x 30.0, r = 4.5)
    final rrect = RRect.fromRectAndRadius(
      const Rect.fromLTWH(28.5, 9.0, 39.0, 30.0),
      const Radius.circular(4.5),
    );
    canvas.drawRRect(rrect, strokePaint);

    // 2. Envelope flap
    final flapPath = Path()
      ..moveTo(28.5, 13.5)
      ..lineTo(30.64, 17.82)
      ..lineTo(48.0, 27.7165)
      ..lineTo(65.36, 17.818)
      ..lineTo(67.5, 13.5);
    canvas.drawPath(flapPath, strokePaint);

    // 3. Letter D
    final dPath = Path()
      ..moveTo(4.208, 12.664)
      ..lineTo(12.016, 12.664)
      ..cubicTo(18.192, 12.664, 23.792, 16.269, 23.792, 23.864)
      ..cubicTo(23.792, 31.416, 18.192, 35.0, 12.016, 35.0)
      ..lineTo(4.208, 35.0)
      ..close()
      ..moveTo(8.688, 16.44)
      ..lineTo(11.856, 16.44)
      ..cubicTo(16.016, 16.44, 19.216, 18.424, 19.216, 23.864)
      ..cubicTo(19.216, 29.272, 16.016, 31.192, 11.856, 31.192)
      ..lineTo(8.688, 31.192)
      ..close();
    dPath.fillType = PathFillType.evenOdd;
    canvas.drawPath(dPath, fillPaint);

    // Letter i dot & stem
    canvas.drawCircle(const Offset(75.1675, 12.536), 2.624, fillPaint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(72.8955, 17.272, 4.48, 17.728),
        const Radius.circular(1.0),
      ),
      fillPaint,
    );

    // Letter s
    final sPath = Path()
      ..moveTo(88.5858, 35.288)
      ..cubicTo(84.68, 35.288, 81.92, 33.27, 80.84, 29.4)
      ..lineTo(85.35, 29.4)
      ..cubicTo(85.76, 30.64, 86.94, 31.76, 88.55, 31.76)
      ..cubicTo(91.02, 31.76, 91.27, 30.47, 91.27, 29.94)
      ..cubicTo(90.97, 28.94, 88.87, 28.04, 87.59, 27.7)
      ..cubicTo(83.49, 26.37, 81.25, 24.44, 81.25, 22.29)
      ..cubicTo(81.53, 20.41, 83.47, 18.15, 88.26, 16.98)
      ..cubicTo(93.32, 16.98, 95.27, 21.04, 95.40, 22.84)
      ..lineTo(91.11, 22.84)
      ..cubicTo(90.75, 21.58, 89.70, 20.53, 88.13, 20.53)
      ..cubicTo(85.82, 20.53, 85.60, 21.69, 85.60, 22.23)
      ..cubicTo(85.90, 23.28, 88.03, 24.21, 89.28, 24.53)
      ..cubicTo(93.28, 25.86, 95.56, 28.77, 95.56, 29.94)
      ..cubicTo(95.56, 31.88, 93.33, 34.14, 92.26, 34.61)
      ..close();
    canvas.drawPath(sPath, fillPaint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant DopisLogoPainter oldDelegate) =>
      oldDelegate.color != color;
}
