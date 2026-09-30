// Configuração do projeto Firebase. Estes valores NÃO são secretos: só identificam
// o projeto. Quem protege os dados são as regras do Firestore (ver README).
export const firebaseConfig = {
  apiKey: 'AIzaSyAutIxGXw_S_hoVu2yzkom2skpS3gA03i0',
  authDomain: 'daggerborg-sheets.firebaseapp.com',
  projectId: 'daggerborg-sheets',
  storageBucket: 'daggerborg-sheets.firebasestorage.app',
  messagingSenderId: '1027086288680',
  appId: '1:1027086288680:web:e7eead21bc515affbe321d',
};

// SDK carregado da CDN oficial (sem build). Versão fixa: ao atualizar, troque aqui.
export const FIREBASE_SDK_URL = 'https://www.gstatic.com/firebasejs/12.19.0';

// App Check (reCAPTCHA v3): prova ao Firebase que a requisição vem deste site,
// aberto num navegador de verdade — barra scripts usando o projeto por fora.
// Esta é a chave do SITE (pública). A chave SECRETA fica só no console do Firebase.
// Domínios liberados na chave: rannysan.github.io e localhost.
export const RECAPTCHA_SITE_KEY = '6Le9ldYtAAAAAEZNd2DdqbM5eTrelfEQ9Yx75SC0';
