import 'package:flutter/material.dart';

class ResumePreviewPage extends StatelessWidget {
  final Map<String, dynamic> resumeData;
  final Map<String, dynamic>? styleOptions;

  const ResumePreviewPage({
    super.key,
    required this.resumeData,
    this.styleOptions,
  });

  // Helper to parse hex color strings (e.g. #4F46E5) to Flutter Color
  Color _parseColor(String? hexString) {
    if (hexString == null || hexString.isEmpty) {
      return const Color(0xFF4F46E5); // Default Indigo
    }
    try {
      final hex = hexString.replaceAll('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return const Color(0xFF4F46E5);
    }
  }

  // Helper to parse font family string
  String _parseFontFamily(String? fontOption) {
    if (fontOption == null) return 'sans-serif';
    final lower = fontOption.toLowerCase();
    if (lower.contains('georgia')) return 'Georgia';
    if (lower.contains('garamond')) return 'Garamond';
    if (lower.contains('helvetica')) return 'Helvetica';
    if (lower.contains('verdana')) return 'Verdana';
    return 'Calibri'; // Fallback / Default
  }

  // Simple HTML stripping and cleaning helper to format paragraphs and bullets
  String _cleanHtml(String html) {
    if (html.isEmpty) return '';
    
    var text = html;
    
    // Replace list tags
    text = text.replaceAll(RegExp(r'<ul>\s*'), '');
    text = text.replaceAll(RegExp(r'\s*</ul>'), '');
    text = text.replaceAll(RegExp(r'<li>\s*'), ' • ');
    text = text.replaceAll(RegExp(r'\s*</li>'), '\n');
    
    // Replace paragraph tags
    text = text.replaceAll(RegExp(r'<p>\s*'), '');
    text = text.replaceAll(RegExp(r'\s*</p>'), '\n\n');
    
    // Replace emphasis tags
    text = text.replaceAll(RegExp(r'<strong>\s*'), '');
    text = text.replaceAll(RegExp(r'\s*</strong>'), '');
    text = text.replaceAll(RegExp(r'<em>\s*'), '');
    text = text.replaceAll(RegExp(r'\s*</em>'), '');
    
    // Trim extra spaces and newlines
    return text.trim();
  }

  @override
  Widget build(BuildContext context) {
    // Style configurations
    final accentHex = styleOptions?['accentColor'] as String?;
    final themeColor = _parseColor(accentHex);
    final baseFontSize = (styleOptions?['fontSize'] as double?) ?? 11.0;
    final fontFamily = _parseFontFamily(styleOptions?['fontFamily'] as String?);
    // Font styles mapping
    TextStyle getStyle({
      double sizeMultiplier = 1.0,
      FontWeight weight = FontWeight.normal,
      Color? color,
      double? height,
    }) {
      return TextStyle(
        fontFamily: fontFamily,
        fontSize: baseFontSize * sizeMultiplier * 1.2, // scale up slightly for better mobile readability
        fontWeight: weight,
        color: color ?? Colors.white70,
        height: height ?? 1.2,
      );
    }

    final personal = resumeData['personal'] as Map<String, dynamic>? ?? {};
    final summary = resumeData['summary'] as String? ?? '';
    final experiences = (resumeData['experience'] as List?) ?? [];
    final educations = (resumeData['education'] as List?) ?? [];
    final skills = (resumeData['skills'] as List?) ?? [];
    final certifications = (resumeData['certifications'] as List?) ?? [];
    final publications = (resumeData['publications'] as List?) ?? [];
    final projects = (resumeData['projects'] as List?) ?? [];

    return Scaffold(
      backgroundColor: const Color(0xFF0F0C20), // Premium dark background
      appBar: AppBar(
        title: Text(
          'Resume Preview',
          style: TextStyle(fontFamily: fontFamily, fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Candidate Header Info
              Center(
                child: Column(
                  children: [
                    Text(
                      personal['name']?.isNotEmpty == true ? personal['name'] : 'Your Name',
                      style: getStyle(
                        sizeMultiplier: 2.0,
                        weight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 12,
                      runSpacing: 4,
                      children: [
                        if (personal['email']?.isNotEmpty == true)
                          _buildHeaderIconText(Icons.email_outlined, personal['email'], getStyle, themeColor),
                        if (personal['phone']?.isNotEmpty == true)
                          _buildHeaderIconText(Icons.phone_outlined, personal['phone'], getStyle, themeColor),
                        if (personal['location']?.isNotEmpty == true)
                          _buildHeaderIconText(Icons.location_on_outlined, personal['location'], getStyle, themeColor),
                      ],
                    ),
                    if (personal['legalStatus']?.isNotEmpty == true) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Work Status: ${personal['legalStatus']}',
                        style: getStyle(sizeMultiplier: 0.9, color: Colors.white54),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Summary Section
              if (summary.isNotEmpty) ...[
                _buildSectionHeader('Professional Summary', themeColor, getStyle),
                const SizedBox(height: 8),
                Text(
                  _cleanHtml(summary),
                  style: getStyle(height: 1.3),
                ),
                const SizedBox(height: 24),
              ],

              // Experience Section
              if (experiences.isNotEmpty) ...[
                _buildSectionHeader('Work Experience', themeColor, getStyle),
                const SizedBox(height: 8),
                ...experiences.map((exp) {
                  final e = Map<String, dynamic>.from(exp);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                e['jobTitle'] ?? 'Job Title',
                                style: getStyle(weight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                            Text(
                              e['dates'] ?? 'Dates',
                              style: getStyle(sizeMultiplier: 0.9, color: themeColor),
                            ),
                          ],
                        ),
                        Text(
                          e['company'] ?? 'Company Name',
                          style: getStyle(sizeMultiplier: 0.95, weight: FontWeight.w500, color: Colors.white70),
                        ),
                        if (e['description'] != null && e['description'].toString().isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            _cleanHtml(e['description']),
                            style: getStyle(sizeMultiplier: 0.95, height: 1.3),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12),
              ],

              // Education Section
              if (educations.isNotEmpty) ...[
                _buildSectionHeader('Education', themeColor, getStyle),
                const SizedBox(height: 8),
                ...educations.map((edu) {
                  final ed = Map<String, dynamic>.from(edu);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                ed['degree'] ?? 'Degree / Program',
                                style: getStyle(weight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                            Text(
                              ed['graduationYear'] ?? '',
                              style: getStyle(sizeMultiplier: 0.9, color: themeColor),
                            ),
                          ],
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              ed['institution'] ?? 'Institution Name',
                              style: getStyle(sizeMultiplier: 0.95, color: Colors.white70),
                            ),
                            if (ed['gpa'] != null && ed['gpa'].toString().isNotEmpty)
                              Text(
                                'GPA: ${ed['gpa']}',
                                style: getStyle(sizeMultiplier: 0.9, color: Colors.white54),
                              ),
                          ],
                        ),
                        if (ed['achievements'] != null && ed['achievements'].toString().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            _cleanHtml(ed['achievements']),
                            style: getStyle(sizeMultiplier: 0.9, color: Colors.white60),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12),
              ],

              // Skills Section
              if (skills.isNotEmpty) ...[
                _buildSectionHeader('Key Technical Skills', themeColor, getStyle),
                const SizedBox(height: 8),
                ...skills.map((s) {
                  final sk = Map<String, dynamic>.from(s);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: sk['category'] != null && sk['category'].toString().isNotEmpty
                                ? '${sk['category']}: '
                                : 'Skills: ',
                            style: getStyle(weight: FontWeight.bold, color: Colors.white),
                          ),
                          TextSpan(
                            text: sk['skills_list'] ?? '',
                            style: getStyle(),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 16),
              ],

              // Projects Section
              if (projects.isNotEmpty) ...[
                _buildSectionHeader('Key Projects', themeColor, getStyle),
                const SizedBox(height: 8),
                ...projects.map((proj) {
                  final p = Map<String, dynamic>.from(proj);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                p['title'] ?? 'Project Title',
                                style: getStyle(weight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                            if (p['date'] != null)
                              Text(
                                p['date'],
                                style: getStyle(sizeMultiplier: 0.9, color: themeColor),
                              ),
                          ],
                        ),
                        if (p['description'] != null && p['description'].toString().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            _cleanHtml(p['description']),
                            style: getStyle(sizeMultiplier: 0.95, height: 1.3),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12),
              ],

              // Certifications Section
              if (certifications.isNotEmpty) ...[
                _buildSectionHeader('Certifications', themeColor, getStyle),
                const SizedBox(height: 8),
                ...certifications.map((cert) {
                  final c = Map<String, dynamic>.from(cert);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            '• ${c['name'] ?? 'Certification'} (${c['issuer'] ?? 'Issuer'})',
                            style: getStyle(),
                          ),
                        ),
                        if (c['date'] != null)
                          Text(
                            c['date'],
                            style: getStyle(sizeMultiplier: 0.9, color: Colors.white54),
                          ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 16),
              ],

              // Publications Section
              if (publications.isNotEmpty) ...[
                _buildSectionHeader('Publications & Patents', themeColor, getStyle),
                const SizedBox(height: 8),
                ...publications.map((pub) {
                  final pb = Map<String, dynamic>.from(pub);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '• ${pb['title'] ?? 'Publication Title'}',
                          style: getStyle(weight: FontWeight.w600, color: Colors.white),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 10.0),
                          child: Text(
                            'Authors: ${pb['authors'] ?? 'N/A'} | ${pb['journal'] ?? 'Journal'} (${pb['date'] ?? 'Date'})',
                            style: getStyle(sizeMultiplier: 0.9, color: Colors.white60),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderIconText(IconData icon, String text, TextStyle Function({double sizeMultiplier}) styleFunc, Color iconColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 4),
        Text(
          text,
          style: styleFunc(sizeMultiplier: 0.9),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title, Color accentColor, TextStyle Function({double sizeMultiplier, FontWeight weight, Color color}) styleFunc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: styleFunc(
            sizeMultiplier: 1.15,
            weight: FontWeight.bold,
            color: accentColor,
          ),
        ),
        const SizedBox(height: 2),
        Divider(color: accentColor.withOpacity(0.5), thickness: 1.5),
      ],
    );
  }
}
