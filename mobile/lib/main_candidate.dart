import 'package:flutter/material.dart';
import 'package:recruit_edge/pages/home_page.dart';
import 'package:recruit_edge/pages/benefits_page.dart';
import 'package:recruit_edge/pages/testimonials_page.dart';
import 'package:recruit_edge/pages/featured_employers_page.dart';
import 'package:recruit_edge/pages/candidate_dashboard_page.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/animated_background.dart';
import 'package:recruit_edge/widgets/theme_toggle.dart';

void main() {
  runApp(const CandidateApp());
}

class CandidateApp extends StatefulWidget {
  const CandidateApp({super.key});

  @override
  State<CandidateApp> createState() => _CandidateAppState();
}

class _CandidateAppState extends State<CandidateApp> {
  ThemeMode _themeMode = ThemeMode.system;

  void _handleThemeToggle(ThemeMode newThemeMode) {
    setState(() {
      _themeMode = newThemeMode;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recruit Edge - Candidate',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: Colors.white,
        fontFamily: 'Inter',
        textTheme: const TextTheme(
          titleLarge: TextStyle(color: primaryTextColor, fontSize: 24, fontWeight: FontWeight.bold),
          bodyLarge: TextStyle(color: primaryTextColor),
          bodyMedium: TextStyle(color: mutedTextColor),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white.withOpacity(0.1),
          labelStyle: const TextStyle(color: primaryTextColor),
          hintStyle: const TextStyle(color: mutedTextColor),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: mutedTextColor.withOpacity(0.5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Colors.deepPurple, width: 2),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.deepPurple,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: darkBackgroundFrom,
        fontFamily: 'Inter',
        textTheme: const TextTheme(
          titleLarge: TextStyle(color: darkPrimaryTextColor, fontSize: 24, fontWeight: FontWeight.bold),
          bodyLarge: TextStyle(color: darkPrimaryTextColor),
          bodyMedium: TextStyle(color: darkMutedTextColor),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.black.withOpacity(0.3),
          labelStyle: const TextStyle(color: darkPrimaryTextColor),
          hintStyle: const TextStyle(color: darkMutedTextColor),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: darkMutedTextColor.withOpacity(0.5)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Colors.deepPurple, width: 2),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.deepPurpleAccent,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        useMaterial3: true,
      ),
      themeMode: _themeMode,
      home: CandidateMainScreen(
        currentThemeMode: _themeMode,
        onThemeToggle: _handleThemeToggle,
      ),
    );
  }
}

class CandidateMainScreen extends StatefulWidget {
  final ThemeMode currentThemeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const CandidateMainScreen({
    super.key,
    required this.currentThemeMode,
    required this.onThemeToggle,
  });

  @override
  State<CandidateMainScreen> createState() => _CandidateMainScreenState();
}

class _CandidateMainScreenState extends State<CandidateMainScreen> {
  int _selectedIndex = 0;

  final List<Widget> _widgetOptions = <Widget>[
    const HomePage(),
    const CandidateDashboardPage(),
    const BenefitsPage(),
    const TestimonialsPage(),
    const FeaturedEmployersPage(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBackground(
      child: Scaffold(
        appBar: AppBar(
          title: Text('Recruit Edge - Candidate', style: Theme.of(context).textTheme.titleLarge),
          backgroundColor: Colors.transparent,
          elevation: 0,
          actions: [
            ThemeToggle(
              currentThemeMode: widget.currentThemeMode,
              onToggle: widget.onThemeToggle,
            ),
          ],
        ),
        body: Center(
          child: _widgetOptions.elementAt(_selectedIndex),
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          items: const <BottomNavigationBarItem>[
            BottomNavigationBarItem(
              icon: Icon(Icons.home),
              label: 'Home',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people),
              label: 'Benefits',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.star),
              label: 'Testimonials',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.business),
              label: 'Employers',
            ),
          ],
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
        ),
      ),
    );
  }
}
