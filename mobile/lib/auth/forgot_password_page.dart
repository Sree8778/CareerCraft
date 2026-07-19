import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/services/auth_service.dart';
import 'package:recruit_edge/widgets/animated_background.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class ForgotPasswordPage extends StatefulWidget {
  /// Pre-fill the email field if the user already typed one on the login screen.
  final String initialEmail;

  const ForgotPasswordPage({super.key, this.initialEmail = ''});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  late final TextEditingController _emailCtrl;
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailCtrl = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Please enter your email address.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await AuthService.sendPasswordReset(email);
      if (mounted) { setState(() { _sent = true; _loading = false; }); }
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = _friendlyError(e.code);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() { _loading = false; _error = e.toString(); });
      }
    }
  }

  String _friendlyError(String code) {
    switch (code) {
      case 'user-not-found':    return 'No account found with this email address.';
      case 'invalid-email':     return 'Please enter a valid email address.';
      case 'too-many-requests': return 'Too many requests. Please try again later.';
      default:                  return 'Could not send reset email. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor  = isDark ? Colors.white    : Colors.black87;
    final hintColor  = isDark ? Colors.white54  : Colors.black38;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AnimatedBackground(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 320),
                  child: _sent ? _SuccessView(
                    key: const ValueKey('success'),
                    email: _emailCtrl.text.trim(),
                    onBack: () => Navigator.of(context).pop(),
                    onRetry: () => setState(() { _sent = false; _error = null; }),
                  ) : _FormView(
                    key: const ValueKey('form'),
                    emailCtrl: _emailCtrl,
                    loading: _loading,
                    error: _error,
                    textColor: textColor,
                    hintColor: hintColor,
                    onSend: _send,
                    onBack: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Form view ─────────────────────────────────────────────────────────────────

class _FormView extends StatelessWidget {
  final TextEditingController emailCtrl;
  final bool loading;
  final String? error;
  final Color textColor;
  final Color hintColor;
  final VoidCallback onSend;
  final VoidCallback onBack;

  const _FormView({
    super.key,
    required this.emailCtrl,
    required this.loading,
    required this.error,
    required this.textColor,
    required this.hintColor,
    required this.onSend,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Icon
        Center(
          child: Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color: Colors.deepPurple.withOpacity(0.12),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.3)),
            ),
            child: const Icon(Icons.lock_reset_outlined, size: 28, color: Colors.deepPurpleAccent),
          ),
        ),
        const SizedBox(height: 20),

        Text(
          'Forgot your password?',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textColor),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter your email and we\'ll send you a link to reset it.',
          style: TextStyle(fontSize: 13, color: hintColor),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 28),

        // Email field
        TextField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          autofocus: true,
          style: TextStyle(color: textColor),
          onSubmitted: (_) => onSend(),
          decoration: InputDecoration(
            labelText: 'Email address',
            labelStyle: TextStyle(color: hintColor),
            prefixIcon: Icon(Icons.email_outlined, color: hintColor),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),

        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13), textAlign: TextAlign.center),
        ],
        const SizedBox(height: 24),

        // Send button
        SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: loading ? null : onSend,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepPurple,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: loading
                ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Send Reset Link', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 16),

        // Back
        TextButton.icon(
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back, size: 16),
          label: const Text('Back to login'),
          style: TextButton.styleFrom(foregroundColor: Colors.deepPurpleAccent),
        ),
      ],
    );
  }
}

// ── Success view ──────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  final String email;
  final VoidCallback onBack;
  final VoidCallback onRetry;

  const _SuccessView({super.key, required this.email, required this.onBack, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.white54 : Colors.black38;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 64, height: 64,
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.12),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.green.withOpacity(0.4)),
            ),
            child: const Icon(Icons.mark_email_read_outlined, size: 32, color: Colors.green),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'Check your email',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textColor),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: TextStyle(fontSize: 13, color: hintColor, height: 1.6),
            children: [
              const TextSpan(text: 'We sent a password reset link to\n'),
              TextSpan(
                text: email,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white70 : Colors.black87,
                ),
              ),
              const TextSpan(text: '.\n\nClick the link in the email to set a new password. Check your spam folder if you don\'t see it.'),
            ],
          ),
        ),
        const SizedBox(height: 28),

        SizedBox(
          height: 50,
          child: ElevatedButton(
            onPressed: onBack,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.deepPurple,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Back to Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 12),

        TextButton(
          onPressed: onRetry,
          style: TextButton.styleFrom(foregroundColor: Colors.deepPurpleAccent),
          child: const Text('Didn\'t receive it? Try again', style: TextStyle(fontSize: 13)),
        ),
      ],
    );
  }
}
