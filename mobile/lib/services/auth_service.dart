import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';

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

  static Future<void> logout() async {
    await ensureInitialized();
    if (_firebaseInitialized) {
      await FirebaseAuth.instance.signOut();
    }
  }
}
