import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  static bool _firebaseInitialized = false;

  static Future<void> ensureInitialized() async {
    if (_firebaseInitialized) return;
    try {
      await Firebase.initializeApp();
      _firebaseInitialized = true;
      print("Firebase successfully initialized in Mobile app.");
    } catch (e) {
      print("WARNING: Firebase.initializeApp() failed: $e");
      print("Mobile app will fall back to mock auth mode.");
    }
  }

  static Future<String?> login(String email, String password) async {
    await ensureInitialized();
    if (_firebaseInitialized) {
      try {
        UserCredential userCredential = await FirebaseAuth.instance
            .signInWithEmailAndPassword(email: email, password: password);
        return await userCredential.user?.getIdToken();
      } catch (e) {
        print("Firebase sign-in error: $e");
        rethrow;
      }
    } else {
      // Mock auth fallback for seamless testing
      if (email.isNotEmpty && password.isNotEmpty) {
        return "mock_token_for_$email";
      }
      return null;
    }
  }

  static Future<String?> register(String email, String password) async {
    await ensureInitialized();
    if (_firebaseInitialized) {
      try {
        UserCredential userCredential = await FirebaseAuth.instance
            .createUserWithEmailAndPassword(email: email, password: password);
        return await userCredential.user?.getIdToken();
      } catch (e) {
        print("Firebase registration error: $e");
        rethrow;
      }
    } else {
      // Mock signup fallback
      return "mock_token_for_$email";
    }
  }

  static Future<String?> getToken() async {
    await ensureInitialized();
    if (_firebaseInitialized) {
      try {
        User? user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          return await user.getIdToken();
        }
      } catch (e) {
        print("Error getting token: $e");
      }
    }
    return "mock_token";
  }

  static Future<User?> getCurrentUser() async {
    await ensureInitialized();
    return FirebaseAuth.instance.currentUser;
  }

  static Future<User?> signInWithGoogle() async {
    await ensureInitialized();
    try {
      // serverClientId (web OAuth client) is required on Android so that
      // googleAuth.idToken is populated — without it idToken is null and
      // Firebase rejects the credential.
      final googleUser = await GoogleSignIn(
        serverClientId: '414523842687-h7f058ds4fkpqspqgkpjtdc73ruj5j1f.apps.googleusercontent.com',
      ).signIn();
      if (googleUser == null) return null; // user cancelled

      final googleAuth = await googleUser.authentication;

      if (googleAuth.idToken == null) {
        throw Exception('Google idToken is null — check SHA-1 fingerprint is registered in Firebase Console.');
      }

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final result = await FirebaseAuth.instance.signInWithCredential(credential);
      final user = result.user;
      if (user == null) return null;

      // Create Firestore user doc if it doesn't exist yet
      final ref = FirebaseFirestore.instance.collection('users').doc(user.uid);
      final snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          'uid': user.uid,
          'fullName': user.displayName ?? '',
          'email': user.email ?? '',
          'avatar': user.photoURL ?? '',
          'role': 'candidate',
          'onboardingCompleted': false,
          'createdAt': FieldValue.serverTimestamp(),
        });
      }
      return user;
    } catch (e) {
      print('Google sign-in error: $e');
      rethrow;
    }
  }

  /// Sends a Firebase password-reset email to [email].
  static Future<void> sendPasswordReset(String email) async {
    await ensureInitialized();
    await FirebaseAuth.instance.sendPasswordResetEmail(email: email.trim());
  }

  /// Returns true if the current user has an email/password provider linked.
  static bool hasPasswordProvider() {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return false;
    return user.providerData.any((p) => p.providerId == 'password');
  }

  /// Links an email/password credential to a Google-only account.
  /// Call this when [hasPasswordProvider] returns false.
  static Future<void> setupPassword(String password) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('No signed-in user.');
    final email = user.email;
    if (email == null || email.isEmpty) {
      throw Exception('Account has no email address.');
    }
    final credential = EmailAuthProvider.credential(email: email, password: password);
    await user.linkWithCredential(credential);
  }

  /// Re-authenticates with [currentPassword] then updates to [newPassword].
  /// Call this when [hasPasswordProvider] returns true.
  static Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw Exception('No signed-in user.');
    final email = user.email;
    if (email == null || email.isEmpty) {
      throw Exception('Account has no email address.');
    }
    // Firebase requires recent auth before password change.
    final credential = EmailAuthProvider.credential(email: email, password: currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  static Future<void> logout() async {
    await ensureInitialized();
    if (_firebaseInitialized) {
      await GoogleSignIn().signOut();
      await FirebaseAuth.instance.signOut();
    }
  }
}
