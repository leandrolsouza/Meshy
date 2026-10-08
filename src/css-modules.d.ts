declare module '*.module.css' {
    const classes: { readonly [key: string]: string };
    export default classes;
}

declare module '*.css' {
    // Side-effect-only plain CSS import (e.g. import './styles/global.css')
}
