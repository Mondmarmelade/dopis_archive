import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/dopis_logo.dart';
import '../widgets/server_config_dialog.dart';

/// Screen presenting IMAP credentials authentication matching login.astro.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _hostController = TextEditingController(text: 'imap.ionos.de');
  final _portController = TextEditingController(text: '993');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _hostController.dispose();
    _portController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final port = int.tryParse(_portController.text.trim()) ?? 993;

    await auth.login(
      email: _emailController.text,
      password: _passwordController.text,
      host: _hostController.text,
      port: port,
    );
  }

  Widget _buildLabeledField({
    required String label,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 13.0,
            fontWeight: FontWeight.w500,
            color: const Color(0xFF374151),
          ),
        ),
        const SizedBox(height: 4.0),
        child,
        const SizedBox(height: 10.0),
      ],
    );
  }

  InputDecoration _inputDecoration({
    String? hintText,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: (hintText != null && hintText.isNotEmpty) ? hintText : null,
      hintStyle: GoogleFonts.poppins(
        fontSize: 13.5,
        color: const Color(0xFF94A3B8),
      ),
      filled: true,
      fillColor: Colors.white,
      suffixIcon: suffixIcon,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 12.0, vertical: 11.0),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6.0),
        borderSide: const BorderSide(color: Color(0xFFD1D5DB), width: 1.0),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6.0),
        borderSide: const BorderSide(color: Color(0xFF3661A4), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6.0),
        borderSide: const BorderSide(color: Color(0xFFF87171), width: 1.0),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(6.0),
        borderSide: const BorderSide(color: Color(0xFFF87171), width: 1.5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(
              Icons.settings_outlined,
              color: Color(0xFF94A3B8),
              size: 20.0,
            ),
            tooltip: 'Server-URL anpassen',
            onPressed: () => ServerConfigDialog.show(context),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 20.0, vertical: 10.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Logo
                  const DopisLogo(width: 125.0, height: 60.0),
                  const SizedBox(height: 10.0),

                  // Headline
                  Text(
                    'IMAP-Zugangsdaten eingeben',
                    style: GoogleFonts.poppins(
                      fontSize: 22.0,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF3661A4),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 15.0),

                  // Error Banner
                  if (auth.errorMessage != null &&
                      auth.errorMessage!.isNotEmpty)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 15.0),
                      padding: const EdgeInsets.symmetric(
                          vertical: 10.0, horizontal: 14.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        border: Border.all(
                            color: const Color(0xFFF87171), width: 1.0),
                        borderRadius: BorderRadius.circular(6.0),
                      ),
                      child: Text(
                        auth.errorMessage!,
                        style: GoogleFonts.poppins(
                          fontSize: 13.0,
                          fontWeight: FontWeight.w400,
                          color: const Color(0xFF991B1B),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),

                  // Form
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Email
                        _buildLabeledField(
                          label: 'Benutzername / E-Mail:',
                          child: TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            decoration:
                                _inputDecoration(hintText: 'name@domain.de'),
                            style: GoogleFonts.poppins(fontSize: 14.0),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Bitte Benutzername / E-Mail eingeben';
                              }
                              if (!val.contains('@')) {
                                return 'Bitte eine gültige E-Mail-Adresse eingeben';
                              }
                              return null;
                            },
                          ),
                        ),

                        // Password
                        _buildLabeledField(
                          label: 'Passwort:',
                          child: TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            decoration: _inputDecoration(
                              hintText: '••••••••',
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                  size: 18.0,
                                  color: const Color(0xFF94A3B8),
                                ),
                                onPressed: () {
                                  setState(() =>
                                      _obscurePassword = !_obscurePassword);
                                },
                              ),
                            ),
                            style: GoogleFonts.poppins(fontSize: 14.0),
                            validator: (val) {
                              if (val == null || val.isEmpty) {
                                return 'Bitte Passwort eingeben';
                              }
                              return null;
                            },
                          ),
                        ),

                        // IMAP Host
                        _buildLabeledField(
                          label: 'IMAP-Server (Host):',
                          child: TextFormField(
                            controller: _hostController,
                            keyboardType: TextInputType.url,
                            autocorrect: false,
                            decoration: _inputDecoration(),
                            style: GoogleFonts.poppins(fontSize: 14.0),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Bitte IMAP-Server angeben';
                              }
                              return null;
                            },
                          ),
                        ),

                        // IMAP Port
                        _buildLabeledField(
                          label: 'Port:',
                          child: TextFormField(
                            controller: _portController,
                            keyboardType: TextInputType.number,
                            decoration: _inputDecoration(),
                            style: GoogleFonts.poppins(fontSize: 14.0),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return 'Bitte Port angeben';
                              }
                              final p = int.tryParse(val.trim());
                              if (p == null || p < 1 || p > 65535) {
                                return 'Port muss zwischen 1 und 65535 liegen';
                              }
                              return null;
                            },
                          ),
                        ),

                        const SizedBox(height: 10.0),

                        // Submit Button
                        SizedBox(
                          height: 46.0,
                          child: ElevatedButton(
                            onPressed: auth.isLoading ? null : _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF3661A4),
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: const Color(0xFF3661A4)
                                  .withValues(alpha: 0.6),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(6.0),
                              ),
                            ),
                            child: auth.isLoading
                                ? const SizedBox(
                                    width: 20.0,
                                    height: 20.0,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.2,
                                      valueColor:
                                          AlwaysStoppedAnimation<Color>(
                                              Colors.white),
                                    ),
                                  )
                                : Text(
                                    'Mit Postfach verbinden',
                                    style: GoogleFonts.poppins(
                                      fontSize: 14.0,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                    ),
                                  ),
                          ),
                        ),

                        const SizedBox(height: 18.0),

                        // Subtle footer indicator showing active backend URL
                        GestureDetector(
                          onTap: () => ServerConfigDialog.show(context),
                          child: Text(
                            'Server: ${auth.baseUrl}',
                            style: GoogleFonts.poppins(
                              fontSize: 11.0,
                              color: const Color(0xFF94A3B8),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
