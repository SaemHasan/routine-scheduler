// Utility functions for CSV export

/**
 * Helper function to format section display for 0.75 credit courses
 * @param {string} section - The section (A, B, C, etc.)
 * @param {number} classPerWeek - The class per week value (1 for 0.75 credit, 2 for 1.5 credit)
 * @returns {string} - Formatted section display
 */
function formatSectionDisplay(section, classPerWeek) {
  // For 0.75 credit courses (class_per_week = 0.75), show (A1/A2) format
  if (classPerWeek === 0.75) {
    return `${section}1/${section}2`;
  }
  // For other courses, show the section as is
  return section;
}

// Convert array of objects to CSV string
export const arrayToCsv = (data, headers = null) => {
  if (!data || data.length === 0) {
    return '';
  }

  // If headers not provided, use keys from first object
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = csvHeaders.join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return csvHeaders.map(header => {
      let cell = row[header] || '';
      
      // Handle arrays (like multiple teachers)
      if (Array.isArray(cell)) {
        cell = cell.map(item => {
          if (typeof item === 'object') {
            return `${item.surname || item.name || item.initial || JSON.stringify(item)}`;
          }
          return item;
        }).join(' | '); // Use pipe separator instead of semicolon for better readability
      }
      
      // Handle objects
      if (typeof cell === 'object' && cell !== null) {
        cell = JSON.stringify(cell);
      }
      
      // Convert to string and escape quotes
      cell = String(cell).replace(/"/g, '""');
      
      // Wrap in quotes if contains comma, newline, or quote
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        cell = `"${cell}"`;
      }
      
      return cell;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
};

// Download CSV file
export const downloadCsv = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// Export theory distribution to CSV
export const exportTheoryDistributionToCsv = (courses) => {
  const data = courses.map(course => ({
    'Course ID': course.course_id,
    'Course Name': course.course_name || course.course_id,
    'Section': course.section,
    'Assigned Teachers Count': course.teachers_details ? course.teachers_details.length : 0,
    'Assigned Teachers List': course.teachers_details && course.teachers_details.length > 0 
      ? course.teachers_details.map(t => `${t.surname} (${t.initial})`).join(' | ')
      : 'No teachers assigned'
  }));
  
  const csvContent = arrayToCsv(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsv(csvContent, `theory_distribution_${timestamp}.csv`);
};

// Export sessional distribution to CSV
export const exportSessionalDistributionToCsv = (courses) => {
  const data = courses.map(course => ({
    'Course ID': course.course_id,
    'Course Name': course.course_name || course.course_id,
    'Section': formatSectionDisplay(course.section, course.class_per_week),
    'Day': course.day || 'Not scheduled',
    'Time': course.time || 'Not scheduled',
    'Assigned Teachers Count': course.teachers_details ? course.teachers_details.length : 0,
    'Assigned Teachers List': course.teachers_details && course.teachers_details.length > 0 
      ? course.teachers_details.map(t => `${t.surname} (${t.initial})`).join(' | ')
      : 'No teachers assigned'
  }));
  
  const csvContent = arrayToCsv(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsv(csvContent, `sessional_distribution_${timestamp}.csv`);
};

// Export credit distribution to CSV
export const exportCreditDistributionToCsv = (teacherAssignments) => {
  const data = teacherAssignments.map(assignment => {
    // Format theory assignments with line breaks for better readability
    const theoryAssignments = assignment.theoryAssignments.map(ta => 
      `${ta.course_id} (${ta.section})`
    );
    
    // Format sessional assignments with line breaks for better readability
    const sessionalAssignments = assignment.sessionalAssignments.map(sa => 
      `${sa.course_id} (${formatSectionDisplay(sa.section, sa.class_per_week)})`
    );

    return {
      'Teacher Initial': assignment.teacher.initial,
      'Teacher Name': `${assignment.teacher.name} ${assignment.teacher.surname}`,
      'Total Credit': assignment.credits.totalCredit,
      'MSC Courses Credit': assignment.credits.breakdown.msc,
      'Thesis 1 Credit': assignment.credits.breakdown.thesis1,
      'Thesis 2 Credit': assignment.credits.breakdown.thesis2,
      'Theory Assignments Count': theoryAssignments.length,
      'Theory Assignments List': theoryAssignments.join(' | '),
      'Sessional Assignments Count': sessionalAssignments.length,
      'Sessional Assignments List': sessionalAssignments.join(' | ')
    };
  });
  
  const csvContent = arrayToCsv(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCsv(csvContent, `credit_distribution_${timestamp}.csv`);
};
