import 'package:flutter/material.dart';
import 'package:recruit_edge/pages/recruiter_dashboard_page.dart';
import 'package:recruit_edge/pages/recruiter_candidates_page.dart';
import 'package:recruit_edge/pages/recruiter_requisitions_page.dart';
import 'package:recruit_edge/pages/recruiter_job_post_page.dart';
import 'package:recruit_edge/theme/app_theme.dart';
import 'package:recruit_edge/widgets/animated_background.dart';
import 'package:recruit_edge/widgets/theme_toggle.dart';

void main() {
  runApp(const RecruiterApp());
}

class RecruiterApp extends StatefulWidget {
  const RecruiterApp({super.key});

  @override
  State<RecruiterApp> createState() => _RecruiterAppState();
}

class _RecruiterAppState extends State<RecruiterApp> {
  ThemeMode _themeMode = ThemeMode.system;

  void _handleThemeToggle(ThemeMode newThemeMode) {
    setState(() {
      _themeMode = newThemeMode;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Recruit Edge - Recruiter',
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
      home: RecruiterMainScreen(
        currentThemeMode: _themeMode,
        onThemeToggle: _handleThemeToggle,
      ),
    );
  }
}

class RecruiterMainScreen extends StatefulWidget {
  final ThemeMode currentThemeMode;
  final ValueChanged<ThemeMode> onThemeToggle;

  const RecruiterMainScreen({
    super.key,
    required this.currentThemeMode,
    required this.onThemeToggle,
  });

  @override
  State<RecruiterMainScreen> createState() => _RecruiterMainScreenState();
}

class _RecruiterMainScreenState extends State<RecruiterMainScreen> {
  int _selectedIndex = 0;

  final List<Widget> _widgetOptions = <Widget>[
    const RecruiterDashboardPage(),
    const RecruiterCandidatesPage(),
    const RecruiterRequisitionsPage(),
    const RecruiterJobPostPage(),
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
          title: Text('Recruit Edge - Recruiter', style: Theme.of(context).textTheme.titleLarge),
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
              icon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.people),
              label: 'Candidates',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.business_center),
              label: 'Requisitions',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.post_add),
              label: 'Post Job',
            ),
          ],
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
        ),
      ),
    );
  }
}
