/**
 * Work experience location data
 * Contains geographical positions and career history
 */

export const WORK_LOCATIONS = {
  larissa: {
    name: 'Larissa, Greece',
    imageCoords: { x: 777, y: 330 }, // Pin A position on texture
    color: [0.48, 0.68, 0.54], // decay-green RGB
    entries: [
      {
        company: 'MSc Environmental Engineering',
        position: 'Research & Thesis',
        period: '2015 — 2017',
        responsibilities: [
          'Water & soil quality analysis',
          'Laboratory methods & calibration',
          'Environmental compliance research'
        ]
      },
      {
        company: 'Freelance & Early Career',
        position: 'Multiple Roles',
        period: '2015 — 2020',
        responsibilities: [
          'Environmental data analysis',
          'Greek ↔ English translation',
          'Early software development'
        ]
      }
    ]
  },
  barcelona: {
    name: 'Barcelona, Spain',
    imageCoords: { x: 689, y: 310 }, // Pin B position on texture
    color: [1.0, 0.48, 0.2], // orange RGB
    entries: [
      {
        company: 'ADP',
        position: 'Senior Software Engineer',
        period: '2023 — Present',
        responsibilities: [
          'Backend architecture & system design',
          'API development & integration',
          'Technical leadership & mentoring'
        ]
      },
      {
        company: 'Netcompany-Intrasoft',
        position: 'Software Engineer',
        period: '2021 — 2023',
        responsibilities: [
          'Full-stack development (Java, React)',
          'RESTful web services',
          'Test-driven development'
        ]
      },
      {
        company: 'Freelance Work',
        position: 'Developer & Translator',
        period: '2020 — Present',
        responsibilities: [
          'Data annotation for AI training',
          'i18n/l10n services',
          'Custom web development'
        ]
      }
    ]
  }
};
