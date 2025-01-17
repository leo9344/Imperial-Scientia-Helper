// Function to extract section data from the webpage
function extractSections() {
    // Get all section headers (like "Lectures", "Panopto recording")
    const sections = document.querySelectorAll('h3[data-state="open"]');
    
    const sectionData = [];
    
    sections.forEach(section => {
      // Get section title
      const title = section.querySelector('span').textContent;
      
      // Get the content region associated with this section
      const contentRegion = section.nextElementSibling;
      
      // Extract all items in this section
      const items = Array.from(contentRegion.querySelectorAll('a')).map(link => {
        // Get file information
        const fileName = link.querySelector('.c-fGHEql span').textContent;
        const url = new URL(link.href).searchParams.get('url');
        
        // Determine file type from the fileName
        const fileType = fileName.split('.').pop().toLowerCase();
        
        // Get tags
        const tags = Array.from(link.querySelectorAll('.c-SvHcH')).map(tag => 
          tag.textContent.replace('#', '')
        );
        
        return {
          fileName,
          url,
          fileType,
          tags
        };
      });
      
      sectionData.push({
        title,
        items
      });
    });
    
    return sectionData;
  }
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSections") {
      const sections = extractSections();
      sendResponse({sections});
    }
  });
  
  // Notify that the content script is ready
  chrome.runtime.sendMessage({action: "contentScriptReady"});