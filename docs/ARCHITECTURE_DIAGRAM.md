graph TD
    %% Subgraph: Mobile Edge (PWA)
    subgraph Mobile_Edge ["Mobile Edge PWA"]
        direction TB
        UI[React UI]
        Cam[WebRTC Camera]
        
        subgraph AI_Engine ["AI Inference Engine"]
            Inf[Inference Abstraction]
            Blur[Blur Detection]
            Worker[Web Worker]
            LiteRT[LiteRT WASM]
            Model[TFLite INT8 Model]
        end

        subgraph Local_Persistence ["Offline Data Layer"]
            RxDB[RxDB Singleton]
            Dexie[Dexie IndexedDB]
        end

        UI --> Cam
        UI <--> Inf
        Inf --> Blur
        Blur --> Worker
        Worker <--> LiteRT
        LiteRT --> Model
        
        UI <--> RxDB
        RxDB <--> Dexie
    end

    %% Subgraph: Sync Middleware
    subgraph Sync_Middleware ["Sync Middleware"]
        direction TB
        Sync[Sync Service]
        API[Express Sync Gateway]
    end

    RxDB <--> Sync
    Sync <--> API

    %% Subgraph: Cloud Infrastructure
    subgraph Cloud_Infrastructure ["Cloud Infrastructure"]
        direction TB
        DB_Cloud[(PostgreSQL Cloud)]
        
        subgraph ML_Compute ["Compute Engine"]
            FastAPI[FastAPI ML Service]
            Train[Model Training]
            Quant[INT8 Quantization]
        end
    end

    API <--> DB_Cloud
    FastAPI --> Train
    Train --> Quant
    Quant -- Export --> Model

    %% Styling
    classDef mobile fill:#1a3a1a,stroke:#2e7d32,stroke-width:2px,color:#fff
    classDef middleware fill:#1a237e,stroke:#3f51b5,stroke-width:2px,color:#fff
    classDef cloud fill:#3e2723,stroke:#795548,stroke-width:2px,color:#fff
    classDef engine fill:#bf360c,stroke:#ff5722,stroke-width:2px,color:#fff

    class Mobile_Edge mobile
    class Sync_Middleware middleware
    class Cloud_Infrastructure cloud
    class AI_Engine engine
    class ML_Compute engine
