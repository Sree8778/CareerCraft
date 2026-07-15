import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:recruit_edge/auth/login_page.dart';
import 'package:recruit_edge/auth/signup_page.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/animated_background.dart';
import 'package:recruit_edge/widgets/theme_toggle.dart';

// Candidate pages
import 'package:recruit_edge/pages/candidate_dashboard_page.dart';
import 'package:recruit_edge/pages/job_search_page.dart';
import 'package:recruit_edge/pages/candidate_applications_page.dart';
import 'package:recruit_edge/pages/candidate_messages_page.dart';
import 'package:recruit_edge/pages/candidate_profile_page.dart';
import 'package:recruit_edge/pages/feed_page.dart';
import 'package:recruit_edge/pages/network_page.dart';
import 'package:recruit_edge/pages/more_page.dart';

// Recruiter pages
import 'package:recruit_edge/pages/recruiter_dashboard_page.dart';
import 'package:recruit_edge/pages/recruiter_candidates_page.dart';
import 'package:recruit_edge/pages/recruiter_requisitions_page.dart';
import 'package:recruit_edge/pages/recruiter_messages_page.dart';
import 'package:recruit_edge/pages/recruiter_job_post_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const RecruitEdgeApp());
}

class RecruitEdgeApp extends StatefulWidget {
  const RecruitEdgeApp({super.key});

  @override
  State<RecruitEdgeApp> createState() => _RecruitEdgeAppState();
}

class _RecruitEdgeAppState extends State<RecruitEdgeApp> {
  ThemeMode _themeMode = ThemeMode.dark;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recruit Edge',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: Colors.white,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: darkBackgroundFrom,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.deepPurple,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: AuthGate(
        themeMode: _themeMode,
        onThemeToggle: (mode) => setState(() => _themeMode = mode),
      ),
    );
  }
}

// Watches Firebase auth state and routes to login or role-based shell
class AuthGate extends StatelessWidget {
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const AuthGate({super.key, required this.themeMode, required this.onThemeToggle});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.data == null) {
          return LoginPage(
            onLoginSuccess: () {},
            onGoToSignup: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => SignupPage(onSignupSuccess: () {})),
            ),
          );
        }
        // User is logged in — fetch role and show the right shell
        return RoleRouter(
          user: snapshot.data!,
          themeMode: themeMode,
          onThemeToggle: onThemeToggle,
        );
      },
    );
  }
}

// Fetches the user's role from Firestore then shows candidate or recruiter shell
class RoleRouter extends StatelessWidget {
  final User user;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const RoleRouter({
    super.key,
    required this.user,
    required this.themeMode,
    required this.onThemeToggle,
  });

  Future<String> _getRole() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();
      return doc.data()?['role'] ?? 'candidate';
    } catch (_) {
      return 'candidate';
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _getRole(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final role = snapshot.data!;
        if (role == 'recruiter') {
          return RecruiterShell(themeMode: themeMode, onThemeToggle: onThemeToggle);
        }
        return CandidateShell(themeMode: themeMode, onThemeToggle: onThemeToggle);
      },
    );
  }
}

// Candidate bottom-nav shell
class CandidateShell extends StatefulWidget {
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const CandidateShell({super.key, required this.themeMode, required this.onThemeToggle});

  @override
  State<CandidateShell> createState() => _CandidateShellState();
}

class _CandidateShellState extends State<CandidateShell> {
  int _index = 0;

  final _pages = const [
    CandidateDashboardPage(),
    JobSearchPage(),
    FeedPage(),
    CandidateMessagesPage(),
    MorePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return AnimatedBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Recruit Edge'),
          backgroundColor: Colors.transparent,
          elevation: 0,
          actions: [
            ThemeToggle(
              currentThemeMode: widget.themeMode,
              onToggle: widget.onThemeToggle,
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Sign out',
              onPressed: () => FirebaseAuth.instance.signOut(),
            ),
          ],
        ),
        body: _pages[_index],
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.search_outlined), selectedIcon: Icon(Icons.search), label: 'Jobs'),
            NavigationDestination(icon: Icon(Icons.feed_outlined), selectedIcon: Icon(Icons.feed), label: 'Feed'),
            NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Messages'),
            NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'More'),
          ],
        ),
      ),
    );
  }
}

// Recruiter bottom-nav shell
class RecruiterShell extends StatefulWidget {
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const RecruiterShell({super.key, required this.themeMode, required this.onThemeToggle});

  @override
  State<RecruiterShell> createState() => _RecruiterShellState();
}

class _RecruiterShellState extends State<RecruiterShell> {
  int _index = 0;

  final _pages = const [
    RecruiterDashboardPage(),
    RecruiterRequisitionsPage(),
    RecruiterCandidatesPage(),
    RecruiterJobPostPage(),
    RecruiterMessagesPage(),
  ];

  @override
  Widget build(BuildContext context) {
    return AnimatedBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: const Text('Recruit Edge — Recruiter'),
          backgroundColor: Colors.transparent,
          elevation: 0,
          actions: [
            ThemeToggle(
              currentThemeMode: widget.themeMode,
              onToggle: widget.onThemeToggle,
            ),
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Sign out',
              onPressed: () => FirebaseAuth.instance.signOut(),
            ),
          ],
        ),
        body: _pages[_index],
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
            NavigationDestination(icon: Icon(Icons.list_alt_outlined), selectedIcon: Icon(Icons.list_alt), label: 'Requisitions'),
            NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Candidates'),
            NavigationDestination(icon: Icon(Icons.post_add_outlined), selectedIcon: Icon(Icons.post_add), label: 'Post Job'),
            NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Messages'),
          ],
        ),
      ),
    );
  }
}
