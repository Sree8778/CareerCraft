import 'package:flutter/material.dart';
import 'package:recruit_edge/api/api_service.dart';
import 'package:recruit_edge/widgets/glass_card.dart';
import 'package:recruit_edge/pages/company_details_page.dart';

class CompaniesPage extends StatefulWidget {
  const CompaniesPage({super.key});

  @override
  State<CompaniesPage> createState() => _CompaniesPageState();
}

class _CompaniesPageState extends State<CompaniesPage> {
  List<dynamic> _companies = [];
  bool _isLoading = true;
  bool _isSearching = false;
  String _searchQuery = "";
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadCompanies();
  }

  Future<void> _loadCompanies({String? query}) async {
    if (query != null && query.isNotEmpty) {
      setState(() {
        _isSearching = true;
      });
      try {
        final data = await fetchCompanies(search: query);
        setState(() {
          final existingIds = _companies.map((c) => c['id']?.toString()).toSet();
          bool addedAny = false;
          String importedName = "";
          for (final item in data) {
            final id = item['id']?.toString();
            if (id != null && !existingIds.contains(id)) {
              _companies.add(item);
              addedAny = true;
              importedName = item['name'] ?? query;
            }
          }
          _isSearching = false;
          if (addedAny) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: Colors.deepPurpleAccent,
                content: Text('Imported $importedName profile & real-world reviews!'),
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: Colors.amber[800],
                content: const Text('No new company found matching search in registry.'),
              ),
            );
          }
        });
      } catch (e) {
        print('Error searching company registry: $e');
        setState(() {
          _isSearching = false;
        });
      }
    } else {
      setState(() {
        _isLoading = true;
      });
      try {
        final data = await fetchCompanies();
        setState(() {
          _companies = data;
          _isLoading = false;
        });
      } catch (e) {
        print('Error loading companies: $e');
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    final filtered = _companies.where((c) {
      final name = (c['name'] ?? '').toString().toLowerCase();
      final industry = (c['industry'] ?? '').toString().toLowerCase();
      final location = (c['location'] ?? '').toString().toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || industry.contains(query) || location.contains(query);
    }).toList();

    return Scaffold(
      backgroundColor: isDarkMode ? const Color(0xFF0F0C20) : Colors.white,
      appBar: AppBar(
        title: const Text('Company Directory', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: isDarkMode ? Colors.white : Colors.black),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Search input
              TextField(
                controller: _searchController,
                style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                decoration: InputDecoration(
                  hintText: 'Search companies by name or location...',
                  hintStyle: TextStyle(color: isDarkMode ? Colors.white38 : Colors.black38),
                  prefixIcon: const Icon(Icons.search, color: Colors.deepPurpleAccent),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, color: Colors.grey),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _searchQuery = "";
                            });
                          },
                        )
                      : null,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: isDarkMode ? Colors.black.withOpacity(0.2) : Colors.grey.withOpacity(0.05),
                ),
                onChanged: (val) {
                  setState(() {
                    _searchQuery = val;
                  });
                },
                onSubmitted: (val) {
                  if (val.trim().isNotEmpty) {
                    _loadCompanies(query: val.trim());
                  }
                },
              ),
              const SizedBox(height: 20),

              // Listings
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent))
                    : filtered.isEmpty
                        ? (_searchQuery.isNotEmpty
                            ? Center(
                                child: SingleChildScrollView(
                                  child: GlassCard(
                                    margin: const EdgeInsets.all(16),
                                    child: Padding(
                                      padding: const EdgeInsets.all(24.0),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.business_outlined,
                                            size: 64,
                                            color: Colors.white30,
                                          ),
                                          const SizedBox(height: 16),
                                          Text(
                                            'No matches for "$_searchQuery"',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: isDarkMode ? Colors.white70 : Colors.black87,
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(height: 12),
                                          Text(
                                            'Query the global real-world registry to dynamically import profile details & employee reviews.',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              color: isDarkMode ? Colors.white54 : Colors.black54,
                                              fontSize: 12,
                                              height: 1.4,
                                            ),
                                          ),
                                          const SizedBox(height: 24),
                                          _isSearching
                                              ? const CircularProgressIndicator(color: Colors.deepPurpleAccent)
                                              : SizedBox(
                                                  width: double.infinity,
                                                  child: ElevatedButton.icon(
                                                    style: ElevatedButton.styleFrom(
                                                      backgroundColor: Colors.deepPurpleAccent,
                                                      foregroundColor: Colors.white,
                                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                                      shape: RoundedRectangleBorder(
                                                        borderRadius: BorderRadius.circular(12),
                                                      ),
                                                    ),
                                                    onPressed: () => _loadCompanies(query: _searchQuery),
                                                    icon: const Icon(Icons.travel_explore),
                                                    label: const Text(
                                                      'Discover & Import Company',
                                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                                    ),
                                                  ),
                                                ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              )
                            : const Center(
                                child: Text(
                                  'No companies found in database.',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ))
                        : RefreshIndicator(
                            onRefresh: _loadCompanies,
                            color: Colors.deepPurpleAccent,
                            child: ListView.builder(
                              itemCount: filtered.length,
                              itemBuilder: (context, idx) {
                                final company = filtered[idx];
                                return GlassCard(
                                  margin: const EdgeInsets.only(bottom: 16),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => CompanyDetailsPage(company: company),
                                      ),
                                    );
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              width: 50,
                                              height: 50,
                                              decoration: BoxDecoration(
                                                color: Colors.white.withOpacity(0.05),
                                                borderRadius: BorderRadius.circular(12),
                                                image: company['logoUrl'] != null
                                                    ? DecorationImage(
                                                        image: NetworkImage(company['logoUrl']),
                                                        fit: BoxFit.cover,
                                                      )
                                                    : null,
                                              ),
                                              child: company['logoUrl'] == null
                                                  ? const Icon(Icons.business, color: Colors.deepPurpleAccent)
                                                  : null,
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    company['name'] ?? 'Company Name',
                                                    style: TextStyle(
                                                      color: isDarkMode ? Colors.white : Colors.black87,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 16,
                                                    ),
                                                  ),
                                                  Text(
                                                    company['industry'] ?? 'Technology',
                                                    style: const TextStyle(
                                                      color: Colors.deepPurpleAccent,
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const Icon(Icons.chevron_right, color: Colors.grey),
                                          ],
                                        ),
                                        const SizedBox(height: 12),
                                        Text(
                                          company['bio'] ?? '',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: isDarkMode ? Colors.white70 : Colors.black54,
                                            fontSize: 13,
                                            height: 1.4,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        Row(
                                          children: [
                                            const Icon(Icons.location_on, size: 14, color: Colors.grey),
                                            const SizedBox(width: 4),
                                            Text(
                                              company['location'] ?? 'Unknown',
                                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                                            ),
                                            const SizedBox(width: 16),
                                            const Icon(Icons.people, size: 14, color: Colors.grey),
                                            const SizedBox(width: 4),
                                            Text(
                                              '${company['employeesCount'] ?? "0"} employees',
                                              style: const TextStyle(color: Colors.grey, fontSize: 11),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
