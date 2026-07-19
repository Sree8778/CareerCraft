import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:recruit_edge/services/auth_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

/// Lets Google Sign-In users set a password for the first time (link),
/// or lets any user change their existing password (re-auth + update).
class SetupPasswordPage extends StatefulWidget {
  const SetupPasswordPage({super.key});

  @override
  State<SetupPasswordPage> createState() => _SetupPasswordPageState();
}

class _SetupPasswordPageState extends State<SetupPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPwCtrl  = TextEditingController();
  final _newPwCtrl      = TextEditingController();
  final _confirmPwCtrl  = TextEditingController();

  bool _hideCurrent = true;
  bool _hideNew     = true;
  bool _hideConfirm = true;
  bool _loading     = false;
  String? _error;

  late final bool _hasPassword;
  late final String _email;

  @override
  void initState() {
    super.initState();
    _hasPassword = AuthService.hasPasswordProvider();
    _email = FirebaseAuth.instance.currentUser?.email ?? '';
  }

  @override
  void dispose() {
    _currentPwCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmPwCtrl.dispose();
    super.dispose();
  }

  // ── Password strength ─────────────────────────────────────────────────────

  int _strength(String pw) {
    if (pw.isEmpty) return 0;
    int score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (RegExp(r'[A-Z]').hasMatch(pw)) score++;
    if (RegExp(r'[0-9]').hasMatch(pw)) score++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(pw)) score++;
    return score; // 0-5
  }

  Color _strengthColor(int s) {
    if (s <= 1) return Colors.red.shade400;
    if (s <= 2) return Colors.orange.shade400;
    if (s <= 3) return Colors.yellow.shade700;
    return Colors.green.shade500;
  }

  String _strengthLabel(int s) {
    if (s <= 1) return 'Weak';
    if (s <= 2) return 'Fair';
    if (s <= 3) return 'Good';
    return 'Strong';
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });

    try {
      if (_hasPassword) {
        await AuthService.changePassword(
          currentPassword: _currentPwCtrl.text,
          newPassword: _newPwCtrl.text,
        );
      } else {
        await AuthService.setupPassword(_newPwCtrl.text);
      }

      if (!mounted) return;
      _showSuccess();
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _friendlyError(e.code));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _friendlyError(String code) {
    switch (code) {
      case 'wrong-password':
      case 'invalid-credential':
        return 'Current password is incorrect.';
      case 'weak-password':
        return 'Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.';
      case 'requires-recent-login':
        return 'Please sign out and sign in again before changing your password.';
      case 'credential-already-in-use':
        return 'This email already has a password set on a different account.';
      case 'email-already-in-use':
        return 'An account with this email already exists.';
      case 'provider-already-linked':
        return 'A password is already linked to this account. Use "Change Password" instead.';
      default:
        return 'Something went wrong ($code). Please try again.';
    }
  }

  void _showSuccess() {
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _hasPassword
              ? 'Password updated successfully.'
              : 'Password set! You can now sign in with email + password.',
        ),
        backgroundColor: Colors.green.shade600,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final pw = _newPwCtrl.text;
    final strength = _strength(pw);

    return Scaffold(
      appBar: AppBar(
        title: Text(_hasPassword ? 'Change Password' : 'Set Up Password'),
        centerTitle: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Info card ─────────────────────────────────────────────
                GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          _hasPassword
                              ? Icons.lock_reset_outlined
                              : Icons.lock_open_outlined,
                          size: 22,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _hasPassword
                                    ? 'Change your password'
                                    : 'Add a password to your account',
                                style: theme.textTheme.titleSmall,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _hasPassword
                                    ? 'Enter your current password, then choose a new one.'
                                    : 'You signed in with Google. Setting a password lets you '
                                      'also sign in with $_email + password.',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // ── Email chip (read-only) ─────────────────────────────────
                if (_email.isNotEmpty) ...[
                  Text('Account', style: _sectionLabel(context)),
                  const SizedBox(height: 6),
                  GlassCard(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Icon(Icons.email_outlined, size: 18,
                              color: isDark ? Colors.grey.shade400 : Colors.grey.shade600),
                          const SizedBox(width: 10),
                          Text(_email,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: isDark ? Colors.grey.shade300 : Colors.grey.shade700,
                              )),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // ── Current password (only when changing) ─────────────────
                if (_hasPassword) ...[
                  Text('Current Password', style: _sectionLabel(context)),
                  const SizedBox(height: 6),
                  _PwField(
                    controller: _currentPwCtrl,
                    hint: 'Enter current password',
                    obscure: _hideCurrent,
                    onToggle: () => setState(() => _hideCurrent = !_hideCurrent),
                    validator: (v) => (v == null || v.isEmpty)
                        ? 'Please enter your current password.'
                        : null,
                  ),
                  const SizedBox(height: 20),
                ],

                // ── New password ──────────────────────────────────────────
                Text(
                  _hasPassword ? 'New Password' : 'Password',
                  style: _sectionLabel(context),
                ),
                const SizedBox(height: 6),
                _PwField(
                  controller: _newPwCtrl,
                  hint: 'At least 8 characters',
                  obscure: _hideNew,
                  onToggle: () => setState(() => _hideNew = !_hideNew),
                  onChanged: (_) => setState(() {}),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Please enter a password.';
                    if (v.length < 8) return 'Password must be at least 8 characters.';
                    if (_hasPassword && v == _currentPwCtrl.text) {
                      return 'New password must differ from the current one.';
                    }
                    return null;
                  },
                ),

                // ── Strength bar ──────────────────────────────────────────
                if (pw.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: strength / 5,
                            color: _strengthColor(strength),
                            backgroundColor: isDark
                                ? Colors.grey.shade800
                                : Colors.grey.shade200,
                            minHeight: 5,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        _strengthLabel(strength),
                        style: TextStyle(
                          fontSize: 11,
                          color: _strengthColor(strength),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Use 12+ characters, mix upper & lower case, numbers, and symbols.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: isDark ? Colors.grey.shade500 : Colors.grey.shade500,
                    ),
                  ),
                ],
                const SizedBox(height: 20),

                // ── Confirm password ──────────────────────────────────────
                Text('Confirm Password', style: _sectionLabel(context)),
                const SizedBox(height: 6),
                _PwField(
                  controller: _confirmPwCtrl,
                  hint: 'Re-enter your password',
                  obscure: _hideConfirm,
                  onToggle: () => setState(() => _hideConfirm = !_hideConfirm),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Please confirm your password.';
                    if (v != _newPwCtrl.text) return 'Passwords do not match.';
                    return null;
                  },
                ),
                const SizedBox(height: 28),

                // ── Error banner ──────────────────────────────────────────
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.red.shade900.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade700.withOpacity(0.4)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, size: 18, color: Colors.red.shade400),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _error!,
                            style: TextStyle(color: Colors.red.shade300, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Submit button ─────────────────────────────────────────
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _loading ? null : _submit,
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _loading
                        ? const SizedBox(
                            height: 18, width: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Text(
                            _hasPassword ? 'Update Password' : 'Set Password',
                            style: const TextStyle(fontSize: 15),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  TextStyle? _sectionLabel(BuildContext context) =>
      Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: 0.3,
      );
}

// ── Reusable password field ───────────────────────────────────────────────────

class _PwField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool obscure;
  final VoidCallback onToggle;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;

  const _PwField({
    required this.controller,
    required this.hint,
    required this.obscure,
    required this.onToggle,
    this.onChanged,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      onChanged: onChanged,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            size: 20,
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}
