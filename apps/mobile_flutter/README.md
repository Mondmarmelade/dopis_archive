# Dopis Mobile (Flutter)

Production-grade Flutter mobile application for Dopis email client.

## Platforms
- Android
- Web
- Windows

## Architecture
- `lib/models/`: Data models (`UserSession`, `EmailSummary`, `EmailDetail`, `AiAnalysisResult`)
- `lib/services/`: Services (`StorageService`, `ApiService`)
- `lib/providers/`: State management (`AuthProvider`)
- `lib/theme/`: Global theme (`AppTheme`)
- `lib/widgets/`: Reusable components (`DopisLogo`, `ServerConfigDialog`)
- `lib/screens/`: App screens (`LoginScreen`)
- `test/`: Unit and widget test suite
