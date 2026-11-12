import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

/// Discreet dialog to configure Astro backend REST API base URL.
class ServerConfigDialog extends StatefulWidget {
  const ServerConfigDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => const ServerConfigDialog(),
    );
  }

  @override
  State<ServerConfigDialog> createState() => _ServerConfigDialogState();
}

class _ServerConfigDialogState extends State<ServerConfigDialog> {
  late TextEditingController _urlController;

  static const List<Map<String, String>> _presets = [
    {'name': 'Standard (LAN)', 'url': 'http://192.168.178.20:4321'},
    {'name': 'Localhost', 'url': 'http://localhost:4321'},
    {'name': 'Android Emulator', 'url': 'http://10.0.2.2:4321'},
  ];

  @override
  void initState() {
    super.initState();
    final currentUrl = context.read<AuthProvider>().baseUrl;
    _urlController = TextEditingController(text: currentUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.0)),
      title: Text(
        'Server-URL anpassen',
        style: GoogleFonts.poppins(
          fontSize: 16.0,
          fontWeight: FontWeight.w600,
          color: const Color(0xFF3661A4),
        ),
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Astro Backend REST API Adresse:',
              style: GoogleFonts.poppins(
                fontSize: 12.0,
                color: const Color(0xFF475569),
              ),
            ),
            const SizedBox(height: 8.0),
            TextFormField(
              controller: _urlController,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12.0, vertical: 10.0),
                hintText: 'http://192.168.178.20:4321',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide:
                      const BorderSide(color: Color(0xFF3661A4), width: 1.5),
                ),
              ),
              style: GoogleFonts.poppins(fontSize: 13.0),
            ),
            const SizedBox(height: 14.0),
            Text(
              'Schnellwahl:',
              style: GoogleFonts.poppins(
                fontSize: 11.0,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 6.0),
            Wrap(
              spacing: 6.0,
              runSpacing: 6.0,
              children: _presets.map((preset) {
                return ActionChip(
                  label: Text(
                    preset['name']!,
                    style: GoogleFonts.poppins(
                      fontSize: 11.0,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                  backgroundColor: const Color(0xFFF1F5F9),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6.0, vertical: 2.0),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6.0)),
                  onPressed: () {
                    _urlController.text = preset['url']!;
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(
            'Abbrechen',
            style: GoogleFonts.poppins(
                color: const Color(0xFF64748B), fontSize: 13.0),
          ),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF3661A4),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6.0)),
          ),
          onPressed: () {
            final newUrl = _urlController.text.trim();
            if (newUrl.isNotEmpty) {
              context.read<AuthProvider>().setBaseUrl(newUrl);
            }
            Navigator.of(context).pop();
          },
          child: Text(
            'Speichern',
            style: GoogleFonts.poppins(
                fontSize: 13.0, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
