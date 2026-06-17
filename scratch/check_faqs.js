const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_ANON_KEY = envContent.match(/SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkFaqs() {
  const { data: categories, error } = await supabase
    .from('faq_categories')
    .select('name');
  
  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }
  
  console.log('Current FAQ Categories:', categories.map(c => c.name));
  
  const { data: faqs, error: fError } = await supabase
    .from('faqs')
    .select('id, question, faq_categories(name)');
    
  if (fError) {
    console.error('Error fetching FAQs:', fError);
    return;
  }
  
  console.log(`Total FAQs found: ${faqs.length}`);
  
  const categoriesWithFaqs = [...new Set(faqs.map(f => f.faq_categories.name))];
  console.log('Categories with questions:', categoriesWithFaqs);

  const targetCategories = ['Login', 'Payment', 'Premium', 'Privacy', 'Technical'];
  const missingFaqs = targetCategories.filter(tc => !categoriesWithFaqs.includes(tc));
  
  if (missingFaqs.length === 0) {
    console.log('SUCCESS: All target categories have questions.');
  } else {
    console.log('MISSING Questions in Categories:', missingFaqs);
  }
}

checkFaqs();
