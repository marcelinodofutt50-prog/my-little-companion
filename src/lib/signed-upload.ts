/**
 * Envio direto para uma URL assinada de storage.
 *
 * Os arquivos podem viver em um segundo projeto de armazenamento, então o
 * cliente do navegador (que aponta sempre para o projeto principal) não serve
 * para enviar. Aqui usamos a URL assinada devolvida pelo servidor, que já
 * aponta para o projeto correto.
 */
export async function putToSignedUrl(
  uploadUrl: string,
  file: Blob,
  contentType?: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Falha no envio (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Falha de rede durante o envio"));
    xhr.send(file);
  });
}
