import { json } from "@remix-run/node";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // 1. Intentar obtener información del tema activo
    const themesResponse = await admin.rest.get({
      path: "themes.json"
    });
    
    const activeTheme = themesResponse.body.themes.find(theme => theme.role === 'main');
    
    // 2. Intentar obtener configuraciones del tema
    let themeSettings = null;
    if (activeTheme) {
      try {
        const settingsResponse = await admin.rest.get({
          path: `themes/${activeTheme.id}/assets.json`,
          query: { "asset[key]": "config/settings_data.json" }
        });
        
        if (settingsResponse.body.asset?.value) {
          themeSettings = JSON.parse(settingsResponse.body.asset.value);
        }
      } catch (e) {
        console.log('No se pudo obtener settings del tema');
      }
    }
    
    // 3. Intentar obtener archivos de medios
    const filesResponse = await admin.graphql(
      `#graphql
        query {
          files(first: 100, query: "media_type:IMAGE") {
            edges {
              node {
                ... on MediaImage {
                  id
                  image {
                    url
                    altText
                    width
                    height
                  }
                  fileStatus
                  createdAt
                }
              }
            }
          }
        }
      `
    );
    
    const filesData = await filesResponse.json();
    const imageFiles = filesData.data?.files?.edges || [];
    
    // 4. Buscar posibles logos
    const possibleLogos = imageFiles.filter(file => {
      const alt = file.node.image?.altText?.toLowerCase() || '';
      const url = file.node.image?.url?.toLowerCase() || '';
      return alt.includes('logo') || url.includes('logo') || 
             alt.includes('brand') || url.includes('brand');
    });
    
    // 5. Si no hay logos específicos, buscar las primeras imágenes
    const firstImages = imageFiles.slice(0, 10);
    
    return json({
      activeTheme: activeTheme?.name || 'No theme found',
      themeSettings: themeSettings?.current || null,
      possibleLogos: possibleLogos.map(f => f.node.image),
      allImages: firstImages.map(f => f.node.image),
      totalImages: imageFiles.length
    });
    
  } catch (error) {
    return json({
      error: error.message,
      stack: error.stack
    });
  }
};

export default function CheckLogo() {
  const data = useLoaderData();
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Buscar Logo de la Tienda</h1>
      
      {data.error ? (
        <div style={{ background: '#fee', padding: '20px', marginBottom: '20px' }}>
          <h3>Error</h3>
          <pre>{data.error}</pre>
        </div>
      ) : (
        <>
          <div style={{ background: '#f3f4f6', padding: '20px', marginBottom: '20px', borderRadius: '8px' }}>
            <h3>Información del tema</h3>
            <p>Tema activo: {data.activeTheme}</p>
            <p>Total de imágenes en Files: {data.totalImages}</p>
          </div>
          
          {data.possibleLogos.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3>Posibles logos encontrados ({data.possibleLogos.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {data.possibleLogos.map((img, i) => (
                  <div key={i} style={{ background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <img src={img.url} alt={img.altText || `Logo ${i+1}`} style={{ width: '100%', height: 'auto' }} />
                    <p style={{ fontSize: '12px', marginTop: '10px' }}>
                      Alt: {img.altText || 'Sin alt text'}<br/>
                      Tamaño: {img.width}x{img.height}
                    </p>
                    <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{img.url}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h3>Primeras imágenes en la tienda</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              {data.allImages.map((img, i) => (
                <div key={i} style={{ background: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <img src={img.url} alt={img.altText || `Image ${i+1}`} style={{ width: '100%', height: 'auto' }} />
                  <p style={{ fontSize: '10px', marginTop: '5px' }}>
                    {img.altText || 'Sin descripción'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}