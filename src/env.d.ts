/// <reference types="vite/client" />

declare module "*.png?format=webp" {
  const src: string;
  export default src;
}

declare module "*.png?format=avif" {
  const src: string;
  export default src;
}

declare module "*.jpg?format=webp" {
  const src: string;
  export default src;
}

declare module "*.jpeg?format=webp" {
  const src: string;
  export default src;
}
