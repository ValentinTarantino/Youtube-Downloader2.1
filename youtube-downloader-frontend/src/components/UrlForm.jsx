import { BsPlayFill } from 'react-icons/bs';
import { CgSpinner } from 'react-icons/cg';
import './UrlForm.css';

function UrlForm({ url, onUrlChange, onSubmit, isLoading }) {
    return (
        <div className="input-group input-group-lg url-form-container">
            <input
                type="text"
                className="form-control url-input"
                value={url}
                onChange={onUrlChange}
                disabled={isLoading}
            />
            <button
                className="btn cta-button"
                onClick={onSubmit}
                disabled={isLoading}
            >
                {isLoading ? (
                    <CgSpinner className="spinner-icon" />
                ) : (
                    <BsPlayFill className="play-icon" />
                )}
            </button>
        </div>
    );
}

export default UrlForm;