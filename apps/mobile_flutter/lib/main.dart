import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/mail_provider.dart';
import 'services/api_service.dart';
import 'models/email_summary.dart';
import 'screens/email_detail_screen.dart';
import 'screens/login_screen.dart';
import 'screens/mail_list_screen.dart';
import 'theme/app_theme.dart';
import 'widgets/dopis_logo.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DopisApp());
}

class DopisApp extends StatelessWidget {
  const DopisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider()..tryAutoLogin(),
        ),
        ChangeNotifierProxyProvider<AuthProvider, MailProvider>(
          create: (context) {
            final auth = context.read<AuthProvider>();
            return MailProvider(
              apiService: ApiService(
                baseUrl: auth.baseUrl,
                authToken: auth.session?.token,
              ),
            );
          },
          update: (context, auth, mail) {
            mail ??= MailProvider();
            mail.updateAuth(
              authToken: auth.session?.token,
              baseUrl: auth.baseUrl,
              userEmail: auth.userEmail,
            );
            return mail;
          },
        ),
      ],
      child: MaterialApp(
        title: 'Dopis',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AuthGate(),
        routes: {
          '/login': (_) => const LoginScreen(),
          '/mail': (_) => const MailListScreen(),
          '/email-detail': (ctx) {
            final args = ModalRoute.of(ctx)?.settings.arguments;
            if (args is EmailSummary) {
              return EmailDetailScreen(emailSummary: args);
            }
            return const Scaffold(
              body: Center(child: Text('Keine E-Mail ausgewählt')),
            );
          },
        },
      ),
    );
  }
}

/// Dynamic gate directing user to Mail screen if authenticated, Login if not,
/// or splash indicator while checking initial session.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (auth.isAuthenticated) {
      return const MailListScreen();
    }

    // If still in initial auto-login check and not yet completed
    if (auth.isLoading && auth.session == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DopisLogo(width: 130, height: 62),
              SizedBox(height: 24),
              SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return const LoginScreen();
  }
}
