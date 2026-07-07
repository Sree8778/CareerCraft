export interface PhoneCountry {
  code: string;
  flag: string;
  name: string;
  dialCode: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'US', flag: '🇺🇸', name: 'United States', dialCode: '+1' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom', dialCode: '+44' },
  { code: 'CA', flag: '🇨🇦', name: 'Canada', dialCode: '+1' },
  { code: 'IN', flag: '🇮🇳', name: 'India', dialCode: '+91' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia', dialCode: '+61' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany', dialCode: '+49' },
  { code: 'FR', flag: '🇫🇷', name: 'France', dialCode: '+33' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore', dialCode: '+65' },
  { code: 'AE', flag: '🇦🇪', name: 'UAE', dialCode: '+971' },
  { code: 'JP', flag: '🇯🇵', name: 'Japan', dialCode: '+81' },
  { code: 'CN', flag: '🇨🇳', name: 'China', dialCode: '+86' },
  { code: 'BR', flag: '🇧🇷', name: 'Brazil', dialCode: '+55' },
  { code: 'MX', flag: '🇲🇽', name: 'Mexico', dialCode: '+52' },
  { code: 'ZA', flag: '🇿🇦', name: 'South Africa', dialCode: '+27' },
  { code: 'NL', flag: '🇳🇱', name: 'Netherlands', dialCode: '+31' },
  { code: 'SE', flag: '🇸🇪', name: 'Sweden', dialCode: '+46' },
  { code: 'CH', flag: '🇨🇭', name: 'Switzerland', dialCode: '+41' },
  { code: 'IT', flag: '🇮🇹', name: 'Italy', dialCode: '+39' },
  { code: 'ES', flag: '🇪🇸', name: 'Spain', dialCode: '+34' },
  { code: 'KR', flag: '🇰🇷', name: 'South Korea', dialCode: '+82' },
  { code: 'PK', flag: '🇵🇰', name: 'Pakistan', dialCode: '+92' },
  { code: 'NG', flag: '🇳🇬', name: 'Nigeria', dialCode: '+234' },
  { code: 'PH', flag: '🇵🇭', name: 'Philippines', dialCode: '+63' },
  { code: 'MY', flag: '🇲🇾', name: 'Malaysia', dialCode: '+60' },
  { code: 'ID', flag: '🇮🇩', name: 'Indonesia', dialCode: '+62' },
  { code: 'NZ', flag: '🇳🇿', name: 'New Zealand', dialCode: '+64' },
  { code: 'SA', flag: '🇸🇦', name: 'Saudi Arabia', dialCode: '+966' },
  { code: 'EG', flag: '🇪🇬', name: 'Egypt', dialCode: '+20' },
  { code: 'TR', flag: '🇹🇷', name: 'Turkey', dialCode: '+90' },
  { code: 'PL', flag: '🇵🇱', name: 'Poland', dialCode: '+48' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina', dialCode: '+54' },
  { code: 'RU', flag: '🇷🇺', name: 'Russia', dialCode: '+7' },
  { code: 'HK', flag: '🇭🇰', name: 'Hong Kong', dialCode: '+852' },
  { code: 'TW', flag: '🇹🇼', name: 'Taiwan', dialCode: '+886' },
  { code: 'IL', flag: '🇮🇱', name: 'Israel', dialCode: '+972' },
  { code: 'BD', flag: '🇧🇩', name: 'Bangladesh', dialCode: '+880' },
  { code: 'GH', flag: '🇬🇭', name: 'Ghana', dialCode: '+233' },
  { code: 'KE', flag: '🇰🇪', name: 'Kenya', dialCode: '+254' },
  { code: 'UA', flag: '🇺🇦', name: 'Ukraine', dialCode: '+380' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal', dialCode: '+351' },
  { code: 'NO', flag: '🇳🇴', name: 'Norway', dialCode: '+47' },
  { code: 'DK', flag: '🇩🇰', name: 'Denmark', dialCode: '+45' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgium', dialCode: '+32' },
  { code: 'AT', flag: '🇦🇹', name: 'Austria', dialCode: '+43' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand', dialCode: '+66' },
  { code: 'VN', flag: '🇻🇳', name: 'Vietnam', dialCode: '+84' },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia', dialCode: '+57' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile', dialCode: '+56' },
  { code: 'FI', flag: '🇫🇮', name: 'Finland', dialCode: '+358' },
  { code: 'IE', flag: '🇮🇪', name: 'Ireland', dialCode: '+353' },
  { code: 'LK', flag: '🇱🇰', name: 'Sri Lanka', dialCode: '+94' },
  { code: 'MM', flag: '🇲🇲', name: 'Myanmar', dialCode: '+95' },
  { code: 'QA', flag: '🇶🇦', name: 'Qatar', dialCode: '+974' },
  { code: 'KW', flag: '🇰🇼', name: 'Kuwait', dialCode: '+965' },
  { code: 'BH', flag: '🇧🇭', name: 'Bahrain', dialCode: '+973' },
  { code: 'OM', flag: '🇴🇲', name: 'Oman', dialCode: '+968' },
  { code: 'ET', flag: '🇪🇹', name: 'Ethiopia', dialCode: '+251' },
  { code: 'TZ', flag: '🇹🇿', name: 'Tanzania', dialCode: '+255' },
  { code: 'UG', flag: '🇺🇬', name: 'Uganda', dialCode: '+256' },
  { code: 'RO', flag: '🇷🇴', name: 'Romania', dialCode: '+40' },
  { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic', dialCode: '+420' },
  { code: 'HU', flag: '🇭🇺', name: 'Hungary', dialCode: '+36' },
  { code: 'GR', flag: '🇬🇷', name: 'Greece', dialCode: '+30' },
];

export const ADDRESS_COUNTRIES: string[] = [
  'United States', 'United Kingdom', 'Canada', 'India', 'Australia',
  'Germany', 'France', 'Singapore', 'UAE', 'Japan', 'China', 'Brazil',
  'Mexico', 'South Africa', 'Netherlands', 'Sweden', 'Switzerland', 'Italy',
  'Spain', 'South Korea', 'Pakistan', 'Nigeria', 'Philippines', 'Malaysia',
  'Indonesia', 'New Zealand', 'Saudi Arabia', 'Egypt', 'Turkey', 'Poland',
  'Argentina', 'Russia', 'Hong Kong', 'Taiwan', 'Israel', 'Bangladesh',
  'Ghana', 'Kenya', 'Ukraine', 'Portugal', 'Norway', 'Denmark', 'Belgium',
  'Austria', 'Thailand', 'Vietnam', 'Colombia', 'Chile', 'Finland', 'Ireland',
  'Sri Lanka', 'Myanmar', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Ethiopia',
  'Tanzania', 'Uganda', 'Romania', 'Czech Republic', 'Hungary', 'Greece',
  'Bulgaria', 'Croatia', 'Slovakia', 'Serbia', 'Lithuania', 'Latvia', 'Estonia',
];

export const STATE_LISTS: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
    'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'DC',
  ],
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Northwest Territories', 'Nunavut', 'Yukon',
  ],
  'India': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Delhi', 'Chandigarh', 'Puducherry', 'Jammu and Kashmir',
    'Ladakh',
  ],
  'Australia': [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory',
    'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
  ],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'Germany': [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern',
    'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony',
    'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
  ],
  'Brazil': [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
    'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso',
    'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná',
    'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte',
    'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo',
    'Sergipe', 'Tocantins',
  ],
  'Mexico': [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Guanajuato',
    'Guerrero', 'Hidalgo', 'Jalisco', 'Mexico City', 'Michoacán', 'Morelos',
    'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
    'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
    'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
  ],
};

export function parsePhoneString(phone: string): { dialCode: string; countryCode: string; number: string } {
  const match = phone.match(/^(\+\d{1,4})\s*(.*)$/);
  if (match) {
    const dialCode = match[1];
    const number = match[2].replace(/\D/g, '');
    const found = PHONE_COUNTRIES.find(c => c.dialCode === dialCode);
    return { dialCode, countryCode: found?.code ?? 'US', number };
  }
  return { dialCode: '+1', countryCode: 'US', number: phone.replace(/\D/g, '') };
}

export function parseLocationString(loc: string): {
  city: string; state: string; country: string;
} {
  const parts = loc.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return { city: parts[0], state: parts[parts.length - 2], country: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    const maybeUSState = STATE_LISTS['United States']?.find(
      s => s.toLowerCase() === parts[1].toLowerCase()
    );
    return { city: parts[0], state: maybeUSState || '', country: maybeUSState ? 'United States' : parts[1] };
  }
  return { city: parts[0] ?? '', state: '', country: '' };
}
