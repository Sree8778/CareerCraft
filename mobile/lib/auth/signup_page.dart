import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:recruit_edge/services/auth_service.dart';
import 'package:recruit_edge/widgets/animated_background.dart';
import 'package:recruit_edge/widgets/glass_card.dart';

class SignupPage extends StatefulWidget {
  final VoidCallback onSignupSuccess;

  const SignupPage({super.key, required this.onSignupSuccess});

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String _selectedRole = 'candidate';
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  Future<void> _signup() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setState(() => _errorMessage = 'Password must be at least 6 characters.');
      return;
    }

    setState(() { _isLoading = true; _errorMessage = null; });

    try {
      await AuthService.register(email, password);
      // Save user profile to Firestore
      final uid = (await AuthService.getToken()) != null
          ? (await _getCurrentUid())
          : null;
      if (uid != null) {
        await FirebaseFirestore.instance.collection('users').doc(uid).set({
          'name': name,
          'fullName': name,
          'email': email,
          'role': _selectedRole,
          'createdAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true));
      }
      // AuthGate StreamBuilder handles navigation automatically
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = _friendlyError(e.toString()));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<String?> _getCurrentUid() async {
    try {
      final user = await AuthService.getCurrentUser();
      return user?.uid;
    } catch (_) {
      return null;
    }
  }

  String _friendlyError(String raw) {
    if (raw.contains('email-already-in-use')) return 'An account with this email already exists.';
    if (raw.contains('invalid-email')) return 'Please enter a valid email address.';
    if (raw.contains('weak-password')) return 'Password is too weak. Use at least 6 characters.';
    if (raw.contains('network-request-failed')) return 'No internet connection.';
    return 'Sign up failed. Please try again.';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final hintColor = isDark ? Colors.white54 : Colors.black38;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AnimatedBackground(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: GlassCard(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Create account',
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: textColor),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Join Recruit Edge today',
                      style: TextStyle(fontSize: 14, color: hintColor),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),

                    // Full name
                    TextField(
                      controller: _nameController,
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        labelText: 'Full Name',
                        labelStyle: TextStyle(color: hintColor),
                        prefixIcon: Icon(Icons.person_outline, color: hintColor),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Email
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        labelText: 'Email',
                        labelStyle: TextStyle(color: hintColor),
                        prefixIcon: Icon(Icons.email_outlined, color: hintColor),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Password
                    TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        labelStyle: TextStyle(color: hintColor),
                        prefixIcon: Icon(Icons.lock_outline, color: hintColor),
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                            color: hintColor,
                          ),
                          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Role selector
                    Text('I am a:', style: TextStyle(color: hintColor, fontSize: 13)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _RoleChip(
                            label: 'Job Seeker',
                            icon: Icons.person_search_outlined,
                            selected: _selectedRole == 'candidate',
                            onTap: () => setState(() => _selectedRole = 'candidate'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _RoleChip(
                            label: 'Recruiter',
                            icon: Icons.business_center_outlined,
                            selected: _selectedRole == 'recruiter',
                            onTap: () => setState(() => _selectedRole = 'recruiter'),
                          ),
                        ),
                      ],
                    ),

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],

                    const SizedBox(height: 24),

                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _signup,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.deepPurple,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isLoading
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Create Account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Divider
                    Row(children: [
                      Expanded(child: Divider(color: hintColor.withOpacity(0.3))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text('or', style: TextStyle(color: hintColor, fontSize: 12)),
                      ),
                      Expanded(child: Divider(color: hintColor.withOpacity(0.3))),
                    ]),

                    const SizedBox(height: 16),

                    // Google Sign-In
                    SizedBox(
                      height: 50,
                      child: OutlinedButton.icon(
                        onPressed: _isGoogleLoading ? null : () async {
                          setState(() { _isGoogleLoading = true; _errorMessage = null; });
                          try {
                            await AuthService.signInWithGoogle();
                          } catch (e) {
                            if (mounted) setState(() => _errorMessage = 'Google sign-in failed. Try again.');
                          } finally {
                            if (mounted) setState(() => _isGoogleLoading = false);
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: hintColor.withOpacity(0.4)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: _isGoogleLoading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Image.network(
                                'https://www.google.com/favicon.ico',
                                width: 20, height: 20,
                                errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata, size: 22),
                              ),
                        label: Text(
                          _isGoogleLoading ? 'Signing in…' : 'Continue with Google',
                          style: TextStyle(color: textColor, fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Already have an account? ', style: TextStyle(color: hintColor, fontSize: 13)),
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: const Text(
                            'Sign In',
                            style: TextStyle(
                              color: Colors.deepPurpleAccent,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _RoleChip({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? Colors.deepPurple.withOpacity(0.2) : Colors.transparent,
          border: Border.all(
            color: selected ? Colors.deepPurpleAccent : Colors.white24,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: selected ? Colors.deepPurpleAccent : Colors.white54, size: 22),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                color: selected ? Colors.deepPurpleAccent : Colors.white54,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
