import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SenderAvatar extends StatelessWidget {
  final String name;
  final String email;
  final double size;
  final BoxShape shape;
  final double borderRadius;
  final bool showFavicon;

  /// The 11 curated avatar colors matching apps/web/src/components/mail/SenderAvatar.jsx
  static const List<Color> avatarColors = [
    Color(0xFF2563EB), // blue
    Color(0xFF78350F), // warm brown
    Color(0xFF0F766E), // deep teal
    Color(0xFF1D4ED8), // royal blue
    Color(0xFF7C3AED), // violet
    Color(0xFFB91C1C), // red
    Color(0xFFC2410C), // orange
    Color(0xFF047857), // emerald
    Color(0xFF4338CA), // indigo
    Color(0xFFA21CAF), // fuchsia
    Color(0xFF0369A1), // sky
  ];

  static const Set<String> genericProviders = {
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'yahoo.de',
    'gmx.de',
    'gmx.net',
    'gmx.at',
    'gmx.ch',
    'web.de',
    't-online.de',
    'freenet.de',
    '1und1.de',
    'arcor.de',
    'vodafone.de',
    'icloud.com',
    'me.com',
    'mac.com',
    'proton.me',
    'protonmail.com',
    'mail.de',
    'posteo.de',
    'mailbox.org',
    'aol.com',
    'zoho.com',
  };

  const SenderAvatar({
    super.key,
    required this.name,
    required this.email,
    this.size = 36.0,
    this.shape = BoxShape.circle,
    this.borderRadius = 8.0,
    this.showFavicon = false,
  });

  /// Computes deterministic avatar background color using 32-bit signed bitwise hash.
  static Color getAvatarColor(String nameOrEmail) {
    final input = nameOrEmail.trim();
    if (input.isEmpty) return avatarColors.first;

    int hash = 0;
    for (int i = 0; i < input.length; i++) {
      hash = (input.codeUnitAt(i) + ((hash << 5) - hash)).toSigned(32);
    }
    final index = hash.abs() % avatarColors.length;
    return avatarColors[index];
  }

  /// Extracts 1–2 uppercase sender initials matching the web algorithm.
  static String getSenderInitials(String name, String email) {
    final cleanName =
        name.trim().replaceAll(RegExp(r'[^\p{L}\p{N}\s]', unicode: true), '');
    final words =
        cleanName.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();

    if (words.length >= 2) {
      final first = words[0].characters.first;
      final second = words[1].characters.first;
      return '$first$second'.toUpperCase();
    }

    if (words.length == 1 && words[0].isNotEmpty) {
      return words[0].characters.first.toUpperCase();
    }

    if (email.trim().isNotEmpty) {
      final user =
          email.split('@').first.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
      if (user.isNotEmpty) {
        return (user.length >= 2 ? user.substring(0, 2) : user).toUpperCase();
      }
    }

    return '?';
  }

  static String getSenderDomain(String email) {
    if (email.isEmpty) return '';
    final match = RegExp(r'@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})').firstMatch(email);
    if (match != null) {
      return match.group(1)?.toLowerCase().trim() ?? '';
    }
    if (email.contains('@')) {
      return email
          .split('@')
          .last
          .replaceAll(RegExp(r'[<>]'), '')
          .toLowerCase()
          .trim();
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    final domain = getSenderDomain(email);
    final isGeneric = genericProviders.contains(domain);
    final canAttemptLogo = showFavicon && domain.isNotEmpty && !isGeneric;

    if (canAttemptLogo) {
      final faviconUrl =
          'https://www.google.com/s2/favicons?domain=${Uri.encodeComponent(domain)}&sz=${(size * 2).round()}';

      return ClipRRect(
        borderRadius: shape == BoxShape.circle
            ? BorderRadius.circular(size / 2)
            : BorderRadius.circular(borderRadius),
        child: Image.network(
          faviconUrl,
          width: size,
          height: size,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _buildInitialsAvatar(),
        ),
      );
    }

    return _buildInitialsAvatar();
  }

  Widget _buildInitialsAvatar() {
    final initials = getSenderInitials(name, email);
    final color = getAvatarColor(name.isNotEmpty ? name : email);
    final fontSize = size * 0.38;

    return Container(
      width: size,
      height: size,
      constraints: BoxConstraints.tightFor(width: size, height: size),
      decoration: BoxDecoration(
        color: color,
        shape: shape,
        borderRadius:
            shape == BoxShape.circle ? null : BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 2.0,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: GoogleFonts.poppins(
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          height: 1.0,
        ),
      ),
    );
  }
}
