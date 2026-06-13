import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:recruit_edge/models/benefit.dart';
import 'package:recruit_edge/models/testimonial.dart';
import 'package:recruit_edge/models/employer.dart';
import 'package:recruit_edge/services/auth_service.dart';

// Define the base URL of your web application's API
const String baseUrl = 'http://10.0.0.48:5000/api'; // Pointed to active Python Flask backend

// --- Data Fetching Functions (Unauthenticated) ---

Future<List<Benefit>> fetchBenefits() async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/benefits'));

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> benefitsJson = data['benefits'];
      return benefitsJson.map((json) => Benefit.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load benefits. Status code: ${response.statusCode}');
    }
  } catch (e) {
    return [];
  }
}

Future<List<Testimonial>> fetchTestimonials() async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/testimonials'));
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> testimonialsJson = data['testimonials'];
      return testimonialsJson.map((json) => Testimonial.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load testimonials. Status code: ${response.statusCode}');
    }
  } catch (e) {
    return [];
  }
}

Future<List<Employer>> fetchFeaturedEmployers() async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/employers/featured'));

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> employersJson = data['employers'];
      return employersJson.map((json) => Employer.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load featured employers. Status code: ${response.statusCode}');
    }
  } catch (e) {
    return [];
  }
}

// New function to post a job
Future<bool> postJob({
  required String title,
  required String description,
  required String jobType,
}) async {
  try {
    final response = await http.post(
      Uri.parse('$baseUrl/jobs/v1/post'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer ${await AuthService.getToken()}',
      },
      body: jsonEncode(<String, String>{
        'title': title,
        'description': description,
        'jobType': jobType,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return true;
    } else {
      throw Exception('Failed to post job. Status code: ${response.statusCode}, Body: ${response.body}');
    }
  } catch (e) {
    return false;
  }
}

// New function to fetch all jobs
Future<List<Map<String, dynamic>>> fetchJobs() async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/jobs'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> jobsJson = data['jobs'];
      return List<Map<String, dynamic>>.from(jobsJson);
    } else {
      throw Exception('Failed to load jobs. Status code: ${response.statusCode}');
    }
  } catch (e) {
    print('Error fetching jobs: $e');
    return [];
  }
}

// New function to fetch all candidates from the backend
Future<List<Map<String, dynamic>>> fetchCandidates() async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/candidates'),
      headers: <String, String>{
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return List<Map<String, dynamic>>.from(data);
    } else {
      throw Exception('Failed to load candidates. Status code: ${response.statusCode}');
    }
  } catch (e) {
    print('Error fetching candidates: $e');
    return [];
  }
}

// New function to perform Recruiter AI Copilot search
Future<List<dynamic>> searchCandidatesCopilot(String query) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/candidates/search-copilot'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(<String, dynamic>{
        'query': query,
        'candidates': [], // Backend helper will query candidates dynamically
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Copilot search failed: ${response.statusCode}');
    }
  } catch (e) {
    print('Error during Copilot search: $e');
    return [];
  }
}


// --- NEW FEATURE INTEGRATIONS FOR WEB-MOBILE PARITY ---

/// Upload and parse a PDF resume using backend Gemini parser
Future<Map<String, dynamic>?> parseResume(Uint8List fileBytes, String filename) async {
  try {
    final token = await AuthService.getToken();
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/parse-resume'));
    request.headers['Authorization'] = 'Bearer $token';
    
    final multipartFile = http.MultipartFile.fromBytes(
      'file',
      fileBytes,
      filename: filename,
    );
    request.files.add(multipartFile);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['parsedData'] as Map<String, dynamic>;
    } else {
      print('Resume parsing failed: ${response.statusCode} - ${response.body}');
      return null;
    }
  } catch (e) {
    print('Error calling resume parser: $e');
    return null;
  }
}

/// Call section enhancement endpoint using AI
Future<List<String>> enhanceSection(String sectionName, String textToEnhance) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/enhance-section'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(<String, String>{
        'sectionName': sectionName,
        'textToEnhance': textToEnhance,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return List<String>.from(data['enhancedVersions']);
    } else {
      print('Enhancement API error: ${response.body}');
      return _getMockEnhancements(sectionName, textToEnhance);
    }
  } catch (e) {
    print('Enhancement network error: $e');
    return _getMockEnhancements(sectionName, textToEnhance);
  }
}

/// Generate elevator pitch from full resume details using AI
Future<String> generateElevatorPitch(Map<String, dynamic> resumeData) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/generate-elevator-pitch'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(resumeData),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['elevatorPitch'] as String;
    } else {
      print('Pitch generation error: ${response.body}');
      return _getMockPitch(resumeData);
    }
  } catch (e) {
    print('Pitch generation network error: $e');
    return _getMockPitch(resumeData);
  }
}

/// Generate PDF document from resume data
Future<Uint8List?> generatePdf(Map<String, dynamic> resumeData, Map<String, dynamic> styleOptions, bool showPamtenLogo) async {
  try {
    final token = await AuthService.getToken();
    final requestBody = {
      ...resumeData,
      'styleOptions': styleOptions,
      'showPamtenLogo': showPamtenLogo,
    };

    final response = await http.post(
      Uri.parse('$baseUrl/generate-pdf'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(requestBody),
    );

    if (response.statusCode == 200) {
      return response.bodyBytes;
    } else {
      print('PDF generation failed: ${response.statusCode} - ${response.body}');
      return null;
    }
  } catch (e) {
    print('PDF generation network error: $e');
    return null;
  }
}

/// Generate Word (DOCX) document from resume data
Future<Uint8List?> generateDocx(Map<String, dynamic> resumeData, Map<String, dynamic> styleOptions, bool showPamtenLogo) async {
  try {
    final token = await AuthService.getToken();
    final requestBody = {
      ...resumeData,
      'styleOptions': styleOptions,
      'showPamtenLogo': showPamtenLogo,
    };

    final response = await http.post(
      Uri.parse('$baseUrl/generate-docx'),
      headers: <String, String>{
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(requestBody),
    );

    if (response.statusCode == 200) {
      return response.bodyBytes;
    } else {
      print('DOCX generation failed: ${response.statusCode} - ${response.body}');
      return null;
    }
  } catch (e) {
    print('DOCX generation network error: $e');
    return null;
  }
}

// --- PRIVATE MOCK FALLBACK UTILITIES ---

List<String> _getMockEnhancements(String sectionName, String textToEnhance) {
  return [
    textToEnhance, // Option 0: Original
    "[Enhanced Suggestion 1] Dynamically drove growth and implemented key initiatives for $sectionName, optimizing workflows and improving efficiency by 25%. Supported core requirements with state-of-the-art architectures.",
    "[Enhanced Suggestion 2] Spearheaded high-impact contributions in $sectionName utilizing advanced capabilities. Partnered with cross-functional partners to execute scalable solutions.",
  ];
}

String _getMockPitch(Map<String, dynamic> resumeData) {
  final name = resumeData['personal']?['name'] ?? 'Professional Candidate';
  return "Hello, I am $name. I am a passionate and results-driven specialist. I excel in solving complex architectural challenges, leveraging state-of-the-art design systems, and deploying secure databases. I look forward to adding measurable value to your high-performing team!";
}

// --- NEW PORTAL & PARITY CHAT API CALLS ---

Future<List<dynamic>> fetchApplications(String candidateId) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/applications?candidateId=$candidateId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['applications'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error fetching applications: $e');
    return [];
  }
}

Future<bool> applyToJob(String jobId, String coverLetter) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/jobs/$jobId/apply'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'coverLetter': coverLetter}),
    );
    return response.statusCode == 200 || response.statusCode == 201;
  } catch (e) {
    print('Error applying: $e');
    return false;
  }
}

Future<List<dynamic>> fetchChats(String role) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/chats?role=$role'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['chats'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error loading chats: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> createChat({
  required String candidateId,
  required String recruiterId,
  required String jobId,
  required String jobTitle,
  required String candidateName,
  required String recruiterName,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/chats'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'candidateId': candidateId,
        'recruiterId': recruiterId,
        'jobId': jobId,
        'jobTitle': jobTitle,
        'candidateName': candidateName,
        'recruiterName': recruiterName,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['chat'];
    }
    return null;
  } catch (e) {
    print('Error creating chat: $e');
    return null;
  }
}

Future<List<dynamic>> fetchChatMessages(String chatId) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/chats/$chatId/messages'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['messages'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error loading messages: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> sendChatMessage(String chatId, String text, String senderId, String senderName) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/chats/$chatId/messages'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'text': text,
        'senderId': senderId,
        'senderName': senderName,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['message'];
    }
    return null;
  } catch (e) {
    print('Error sending chat message: $e');
    return null;
  }
}

Future<List<dynamic>> fetchNotifications() async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/notifications'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['notifications'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error fetching notifications: $e');
    return [];
  }
}

Future<bool> markNotificationsAsRead() async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/notifications/read-all'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return response.statusCode == 200;
  } catch (e) {
    print('Error reading notifications: $e');
    return false;
  }
}

Future<Map<String, dynamic>?> scheduleInterview({
  required String title,
  required String description,
  required String startTime,
  required int durationMinutes,
  required List<String> attendees,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/interviews/schedule'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'title': title,
        'description': description,
        'startTime': startTime,
        'durationMinutes': durationMinutes,
        'attendees': attendees,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      print('Schedule interview error: ${response.body}');
      return null;
    }
  } catch (e) {
    print('Error scheduling interview: $e');
    return null;
  }
}

Future<List<dynamic>> fetchCompanies({String? search}) async {
  try {
    final uri = search != null && search.isNotEmpty
        ? Uri.parse('$baseUrl/companies?search=${Uri.encodeComponent(search)}')
        : Uri.parse('$baseUrl/companies');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['companies'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error fetching companies: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> fetchCompanyDetails(String companyId) async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/companies/$companyId'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['company'];
    }
    return null;
  } catch (e) {
    print('Error fetching company details: $e');
    return null;
  }
}

Future<List<dynamic>> fetchCompanyReviews(String companyId) async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/companies/$companyId/reviews'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['reviews'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error fetching company reviews: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> submitCompanyReview({
  required String companyId,
  required int rating,
  required int workLifeBalance,
  required int compensation,
  required String reviewText,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/companies/$companyId/reviews'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'rating': rating,
        'workLifeBalance': workLifeBalance,
        'compensation': compensation,
        'reviewText': reviewText,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['review'];
    }
    return null;
  } catch (e) {
    print('Error submitting company review: $e');
    return null;
  }
}

Future<List<dynamic>> fetchCompanyQnA(String companyId) async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/companies/$companyId/qna'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['qna'] ?? [];
    }
    return [];
  } catch (e) {
    print('Error fetching company QnA: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> submitCompanyQuestion({
  required String companyId,
  required String question,
  required String askedBy,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/companies/$companyId/qna'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'question': question,
        'askedBy': askedBy,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['qna'];
    }
    return null;
  } catch (e) {
    print('Error submitting company question: $e');
    return null;
  }
}

Future<Map<String, dynamic>?> submitCompanyAnswer({
  required String companyId,
  required String question,
  required String answer,
  required String answeredBy,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/companies/$companyId/qna'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'question': question,
        'answer': answer,
        'answeredBy': answeredBy,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['qna'];
    }
    return null;
  } catch (e) {
    print('Error submitting company answer: $e');
    return null;
  }
}

Future<Map<String, dynamic>?> fetchSalaryStats() async {
  try {
    final response = await http.get(Uri.parse('$baseUrl/stats/salaries'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['salaries'];
    }
    return null;
  } catch (e) {
    print('Error fetching salary stats: $e');
    return null;
  }
}

Future<bool> triggerJobCrawler() async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/jobs/crawl'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    return response.statusCode == 200;
  } catch (e) {
    print('Error triggering job crawler: $e');
    return false;
  }
}

Future<List<Map<String, dynamic>>> fetchWebhooks() async {
  try {
    final token = await AuthService.getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/webhooks/subscriptions'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final List<dynamic> subs = data['subscriptions'] ?? [];
      return List<Map<String, dynamic>>.from(subs);
    }
    return [];
  } catch (e) {
    print('Error fetching webhooks: $e');
    return [];
  }
}

Future<Map<String, dynamic>?> subscribeWebhook({
  required String url,
  required String description,
}) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/webhooks/subscribe'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'url': url,
        'description': description,
      }),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = json.decode(response.body);
      return data['subscription'];
    }
    return null;
  } catch (e) {
    print('Error subscribing webhook: $e');
    return null;
  }
}

Future<bool> pingWebhook(String url) async {
  try {
    final token = await AuthService.getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/webhooks/test-ping'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'url': url,
      }),
    );
    return response.statusCode == 200;
  } catch (e) {
    print('Error pinging webhook: $e');
    return false;
  }
}