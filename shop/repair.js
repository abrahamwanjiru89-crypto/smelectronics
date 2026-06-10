/* ============================================
   REPAIR PAGE STYLES
   ============================================ */

.repair-hero {
    text-align: center;
    padding: 3rem 0;
    background: linear-gradient(135deg, rgba(0,229,255,0.05), rgba(124,77,255,0.05));
    border-radius: 2rem;
    margin-bottom: 2rem;
}

.repair-stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 1.5rem;
}

.repair-stats div {
    text-align: center;
}

.repair-stats h3 {
    font-size: 2rem;
    color: var(--primary);
}

.repair-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 2rem;
    justify-content: space-between;
    align-items: center;
}

.filter-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.filter-group select {
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
}

#repairSearch {
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    width: 250px;
}

.repair-services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
}

.repair-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
    transition: all 0.3s;
}

.repair-card:hover {
    transform: translateY(-4px);
    border-color: var(--primary);
}

.repair-card-image {
    position: relative;
    height: 200px;
    overflow: hidden;
}

.repair-card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.repair-available,
.repair-unavailable {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 2rem;
    font-size: 0.7rem;
    font-weight: 600;
}

.repair-available {
    background: var(--success);
    color: #000;
}

.repair-unavailable {
    background: var(--danger);
    color: white;
}

.repair-card-body {
    padding: 1rem;
}

.repair-brand {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--primary);
    letter-spacing: 1px;
}

.repair-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0.5rem 0;
}

.repair-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
}

.repair-description {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 0.5rem 0;
    line-height: 1.4;
}

.repair-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
}

.repair-price {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--primary);
}

.repair-empty {
    text-align: center;
    padding: 3rem;
    color: var(--muted);
}

.repair-empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.repair-loading {
    text-align: center;
    padding: 3rem;
}

/* Booking Modal */
.booking-modal-card {
    max-width: 700px;
}

.booking-modal-inner {
    padding: 1.5rem;
}

.booking-service-info {
    display: flex;
    gap: 1rem;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border);
}

.booking-service-info img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 0.5rem;
}

.booking-service-info h3 {
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
}

.booking-price {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--primary);
    margin-top: 0.5rem;
}

.booking-details {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 0.5rem;
}

.form-group {
    margin-bottom: 1rem;
}

.form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--muted);
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.9rem;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
}

.form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
}

@media (max-width: 768px) {
    .repair-filters {
        flex-direction: column;
        align-items: stretch;
    }
    
    .filter-group {
        justify-content: space-between;
    }
    
    #repairSearch {
        width: 100%;
    }
    
    .repair-services-grid {
        grid-template-columns: 1fr;
    }
    
    .booking-service-info {
        flex-direction: column;
        text-align: center;
    }
    
    .booking-service-info img {
        margin: 0 auto;
    }
}
